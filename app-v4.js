let randomFiveButton=null,searchDebounceV4=null;

function patchV4Dom(){
  const hero=document.querySelector('.hero-copy');
  if(hero)hero.textContent='Save Slot шукає ігри для ПК, PlayStation, Xbox, Nintendo, Sega, портативних і ретро-систем. Каталог завантажується онлайн, а доступні оцінки гравців використовуються лише як додатковий сигнал.';
  const eyebrow=document.querySelector('.hero>.eyebrow');if(eyebrow)eyebrow.textContent='КРОСПЛАТФОРМНИЙ ПОШУК І МЕНЕДЖЕР';
  if(!document.getElementById('randomFiveButton')){
    const box=document.createElement('div');box.className='quick-actions';
    box.innerHTML='<button class="pixel-button secondary" id="randomFiveButton" type="button">ВИПАДКОВА П’ЯТІРКА</button><span class="helper">5 різних ігор для однієї платформи з урахуванням попередніх добірок.</span>';
    elements.searchForm.insertAdjacentElement('afterend',box);
  }
  randomFiveButton=document.getElementById('randomFiveButton');
  for(const span of document.querySelectorAll('span')){
    const text=span.textContent.trim();
    if(text==='МІН. STEAM-РЕЙТИНГ')span.textContent='МІН. ОЦІНКА ГРАВЦІВ';
    if(text==='Тільки з рейтингом гравців')span.textContent='Тільки з доступною оцінкою';
    if(text==='Автоматично отримувати Steam-рейтинг')span.textContent='Догружати доступні оцінки гравців';
  }
  const helper=document.querySelector('#settingsDialog .settings-section .helper');
  if(helper)helper.textContent='Wikidata використовується для кросплатформного пошуку, платформ, жанрів, дат, описів та ідентифікаторів. Доступні оцінки гравців догружаються окремо й ніколи не обмежують каталог.';
  const feedback=document.getElementById('searchFeedback');if(feedback)feedback.textContent='Початковий список завантажиться автоматично. Пошук працює без API-ключа.';
  const style=document.createElement('style');style.textContent='.quick-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1rem}.quick-actions .helper{max-width:620px}@media(max-width:620px){.quick-actions{align-items:stretch}.quick-actions .pixel-button{width:100%}}';document.head.append(style);
}

function setLoading(show,title='ШУКАЮ У WIKIDATA...',detail=''){
  elements.loadingPanel.hidden=!show;elements.loadingTitle.textContent=title;elements.loadingDetail.textContent=detail;elements.searchButton.disabled=show;if(randomFiveButton)randomFiveButton.disabled=show;elements.searchButton.textContent=show?'ПОШУК...':'ШУКАТИ';
}

async function wikidataSparql(query,timeout=22000){const url=new URL('https://query.wikidata.org/sparql');url.searchParams.set('query',query);url.searchParams.set('format','json');return fetchJson(url,timeout)}

async function fetchWikipediaImages(entities){
  const result={},groups={uk:[],en:[]};
  for(const entity of Object.values(entities)){const uk=entity.sitelinks?.ukwiki?.title,en=entity.sitelinks?.enwiki?.title;if(uk)groups.uk.push({id:entity.id,title:uk});else if(en)groups.en.push({id:entity.id,title:en})}
  await Promise.all(Object.entries(groups).map(async([lang,items])=>{for(let offset=0;offset<items.length;offset+=40){const chunk=items.slice(offset,offset+40);if(!chunk.length)continue;const url=new URL(`https://${lang}.wikipedia.org/w/api.php`);const params={action:'query',prop:'pageimages',piprop:'thumbnail|original',pithumbsize:'700',titles:chunk.map(x=>x.title).join('|'),format:'json',formatversion:'2',origin:'*'};for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);try{const data=await fetchJson(url,12000),map=new Map(chunk.map(x=>[normalizeText(x.title),x.id]));for(const page of data.query?.pages||[]){const id=map.get(normalizeText(page.title));if(id)result[id]=page.thumbnail?.source||page.original?.source||''}}catch{}}}));
  return result;
}

async function buildGames(query,records){
  const ids=records.slice(0,50).map(x=>x.id),entities=await fetchEntities(ids),filtered=records.filter(x=>entities[x.id]&&isVideoGameEntity(entities[x.id],x)),linked=new Set();
  for(const item of filtered)for(const prop of['P400','P136','P178','P123'])for(const id of claimEntityIds(entities[item.id],prop))linked.add(id);
  const[labels,wikiImages]=await Promise.all([fetchEntities([...linked],'labels'),fetchWikipediaImages(Object.fromEntries(filtered.map(x=>[x.id,entities[x.id]])))]);
  return filtered.map((record,index)=>{const entity=entities[record.id],steamId=claimString(entity,'P1733'),p18=commonsImage(claimString(entity,'P18')),steam=steamId?steamCover(steamId):'',covers=unique([wikiImages[entity.id],p18,steam]),platformIds=claimEntityIds(entity,'P400'),platforms=platformIds.map(id=>entityLabel(labels[id]));return{id:entity.id,title:entityLabel(entity)||record.label,description:entityDescription(entity)||record.description||'',year:claimTime(entity,'P577'),platforms:unique(platforms),platformIds:unique(platformIds),genres:unique(claimEntityIds(entity,'P136').map(id=>entityLabel(labels[id]))),developers:unique(claimEntityIds(entity,'P178').map(id=>entityLabel(labels[id]))),publishers:unique(claimEntityIds(entity,'P123').map(id=>entityLabel(labels[id]))),steamId,cover:covers[0]||'',fallbackCover:covers[1]||'',coverCandidates:covers,wikidataUrl:`https://www.wikidata.org/wiki/${entity.id}`,steamUrl:steamId?`https://store.steampowered.com/app/${steamId}/`:'',relevance:computeRelevance(query,entityLabel(entity)||record.label,index),popularity:Number(record.popularity)||0,rating:null,ratingState:steamId&&state.settings.steamRatings?'pending':'unavailable'}}).sort((a,b)=>b.relevance-a.relevance||b.popularity-a.popularity)
}

function recordsFromSparql(data){return(data.results?.bindings||[]).map(row=>({id:row.game?.value?.match(/Q\d+$/)?.[0],label:'',description:'',popularity:Number(row.sitelinks?.value)||0})).filter(x=>x.id)}

async function loadInitialGames(){
  const sequence=++searchSequence,started=performance.now();currentQuery='Початкова добірка';setLoading(true,'ЗАВАНТАЖУЮ ПОЧАТКОВИЙ СПИСОК...','Отримую популярні ігри для різних платформ');setSourceState('loading','WIKIDATA');setFeedback('Формую стартову кросплатформну добірку...');
  try{const query=`SELECT DISTINCT ?game ?sitelinks WHERE { VALUES ?type { wd:Q7889 wd:Q16070115 wd:Q209163 wd:Q1066707 wd:Q865493 } ?game wdt:P31 ?type; wdt:P400 ?platform; wikibase:sitelinks ?sitelinks. FILTER(?sitelinks > 12) } ORDER BY DESC(?sitelinks) LIMIT 48`,data=await wikidataSparql(query);if(sequence!==searchSequence)return;currentResults=await buildGames('',recordsFromSparql(data));if(sequence!==searchSequence)return;populateFilters();renderGames();setLoading(false);setSourceState('ready','КАТАЛОГ ГОТОВИЙ');setFeedback(`Стартовий список: ${currentResults.length} ігор із різних платформ, завантажено за ${((performance.now()-started)/1000).toFixed(1)} с.`,'success');enrichRatingsV4(currentResults,sequence,started,12)}catch(error){if(sequence!==searchSequence)return;setLoading(false);setSourceState('error','ПОМИЛКА ДЖЕРЕЛА');setFeedback(`Не вдалося завантажити стартовий список: ${error.message}`,'error')}
}

async function searchGames(query){
  const sequence=++searchSequence,started=performance.now();currentQuery=query;setLoading(true);setSourceState('loading','ПОШУК У WIKIDATA');setFeedback(`Шукаю «${query}»...`);elements.resultsTitle.textContent='Виконується пошук';
  try{const[uk,en]=await Promise.allSettled([searchEntities(query,'uk'),searchEntities(query,'en')]);if(sequence!==searchSequence)return;const records=[...new Map([...(uk.value||[]),...(en.value||[])].map(x=>[x.id,x])).values()];if(!records.length)throw new Error('Wikidata не повернула збігів');elements.loadingDetail.textContent=`Перевіряю ${Math.min(records.length,50)} об’єктів, платформи й резервні обкладинки`;currentResults=await buildGames(query,records);if(sequence!==searchSequence)return;populateFilters();renderGames();setLoading(false);if(!currentResults.length){setSourceState('ready','WIKIDATA ГОТОВА');setFeedback(`За запитом «${query}» не знайдено підтверджених відеоігор.`,'error');return}setSourceState('ready','РЕЗУЛЬТАТИ ГОТОВІ');setFeedback(`Знайдено ${currentResults.length} ігор за ${((performance.now()-started)/1000).toFixed(1)} с. Оцінки гравців догружаються лише як додаткові дані.`);enrichRatingsV4(currentResults,sequence,started,16)}catch(error){if(sequence!==searchSequence)return;setLoading(false);currentResults=[];renderGames();setSourceState('error','ПОМИЛКА ДЖЕРЕЛА');setFeedback(`Не вдалося виконати пошук: ${error.message}`,'error')}
}

async function enrichRatingsV4(games,sequence,started,limit){
  if(!state.settings.steamRatings)return;const queue=games.filter(g=>g.steamId&&!g.rating).slice(0,limit);if(!queue.length)return;let done=0,ok=0;const workers=Array.from({length:Math.min(3,queue.length)},async()=>{while(queue.length&&sequence===searchSequence){const game=queue.shift();try{const rating=await fetchSteamSummary(game.steamId);game.rating=rating?{...rating,platformScope:'PC'}:null;game.ratingState=game.rating?'ready':'unavailable';if(game.rating)ok++}catch{game.ratingState='error'}done++;setSourceState('loading',`ОЦІНКИ ${done}/${done+queue.length}`);setFeedback(`Список уже доступний. Додаткові оцінки гравців: ${done} перевірено, ${ok} отримано.`);scheduleRender()}});await Promise.all(workers);if(sequence!==searchSequence)return;setSourceState('ready','ДЖЕРЕЛА ГОТОВІ');setFeedback(`Готово за ${((performance.now()-started)/1000).toFixed(1)} с. Ігор: ${currentResults.length}; доступних оцінок гравців: ${currentResults.filter(g=>g.rating).length}.`,'success');renderGames()
}

function loadCover(img,game){const candidates=unique([...(game.coverCandidates||[]),game.cover,game.fallbackCover]);if(!candidates.length){img.hidden=true;return}let index=0;img.hidden=false;img.src=candidates[0];img.alt=`Обкладинка ${game.title}`;img.addEventListener('error',()=>{index++;if(candidates[index])img.src=candidates[index];else img.hidden=true})}

const renderGameCardV3=renderGameCard;
renderGameCard=function(game){const node=renderGameCardV3(game),card=node.querySelector('.game-card'),rating=card.querySelector('.rating'),reviews=card.querySelector('.reviews'),stateNode=card.querySelector('.rating-state');if(game.rating){rating.title=`Джерело: ${game.rating.source}`;stateNode.textContent=`${game.rating.source} · ${game.rating.platformScope||'додаткове джерело'} · достовірність: ${ratingConfidence(game.rating.total)}`}else{reviews.textContent=game.ratingState==='pending'?'шукаю оцінку':'без доступної оцінки';stateNode.textContent=game.ratingState==='pending'?'Догружаю додаткове джерело оцінок...':'Гра лишається у пошуку незалежно від рейтингу'}return node};

const renderGamesV3=renderGames;
renderGames=function(){renderGamesV3();const rated=currentResults.filter(g=>g.rating?.total).length,pending=currentResults.filter(g=>g.ratingState==='pending').length,platforms=unique(currentResults.flatMap(g=>g.platforms)).length;if(currentResults.length)elements.resultsNote.textContent=`Wikidata: ${currentResults.length} ігор · платформ: ${platforms} · оцінок гравців: ${rated}${pending?` · догружається: ${pending}`:''}`};

async function fetchPlatformGames(platformId){const query=`SELECT DISTINCT ?game ?sitelinks WHERE { VALUES ?type { wd:Q7889 wd:Q16070115 wd:Q209163 wd:Q1066707 wd:Q865493 } ?game wdt:P31 ?type; wdt:P400 wd:${platformId}; wikibase:sitelinks ?sitelinks. FILTER(?sitelinks > 1) } ORDER BY DESC(?sitelinks) LIMIT 100`;return buildGames('',recordsFromSparql(await wikidataSparql(query,24000)))}
function recommendationHistory(){try{return JSON.parse(localStorage.getItem('save-slot-rec-v1'))||{games:[],platforms:[]}}catch{return{games:[],platforms:[]}}}
function choosePlatform(){const selected=elements.platformFilter.value,map=new Map();for(const game of currentResults)game.platformIds?.forEach((id,i)=>{const label=game.platforms[i]||game.platforms[0]||id;if(selected!=='all'&&label!==selected)return;const x=map.get(id)||{id,label,count:0};x.count++;map.set(id,x)});const options=[...map.values()].filter(x=>x.count>=(selected==='all'?2:1));if(!options.length)return null;const recent=new Set(recommendationHistory().platforms.slice(-5));let weighted=options.map(x=>({...x,w:x.count*(recent.has(x.id)?.25:1)})),roll=Math.random()*weighted.reduce((s,x)=>s+x.w,0);for(const x of weighted){roll-=x.w;if(roll<=0)return x}return weighted[0]}
function pickFive(pool){const hist=new Set(recommendationHistory().games.slice(-80)),picked=[],genres=new Set(),tokens=new Set(),left=[...pool];while(picked.length<5&&left.length){let bi=0,bs=-1e9;left.forEach((g,i)=>{const words=normalizeText(g.title).split(' ').filter(x=>x.length>3),repeat=words.some(x=>tokens.has(x)),fresh=hist.has(g.id)?-120:35,newGenres=g.genres.filter(x=>!genres.has(x)).length,pop=Math.log10(1+(g.popularity||0))*16,score=Math.random()*70+fresh+newGenres*18+pop-(repeat?32:0);if(score>bs){bs=score;bi=i}});const[g]=left.splice(bi,1);picked.push(g);g.genres.forEach(x=>genres.add(x));normalizeText(g.title).split(' ').filter(x=>x.length>3).forEach(x=>tokens.add(x))}return picked}
async function generateRandomFive(){let sequence=++searchSequence,platform=choosePlatform();if(!platform){await loadInitialGames();platform=choosePlatform();sequence=++searchSequence}if(!platform)return showToast('Не вдалося визначити платформу','error');setLoading(true,'ФОРМУЮ ВИПАДКОВУ П’ЯТІРКУ...',`Платформа: ${platform.label}`);try{const picked=pickFive(await fetchPlatformGames(platform.id));if(sequence!==searchSequence)return;if(picked.length<5)throw new Error('Замало ігор');currentResults=picked;currentQuery=`Випадкова п’ятірка: ${platform.label}`;populateFilters();if([...elements.platformFilter.options].some(x=>x.value===platform.label))elements.platformFilter.value=platform.label;renderGames();const h=recommendationHistory();h.games=[...h.games,...picked.map(g=>g.id)].slice(-100);h.platforms=[...h.platforms,platform.id].slice(-16);localStorage.setItem('save-slot-rec-v1',JSON.stringify(h));setLoading(false);setSourceState('ready','ДОБІРКА ГОТОВА');setFeedback(`Підібрано 5 різних ігор для ${platform.label}. Наступний запуск уникатиме повторів.`,'success');enrichRatingsV4(picked,sequence,performance.now(),5)}catch(error){if(sequence!==searchSequence)return;setLoading(false);setFeedback(`Не вдалося сформувати добірку: ${error.message}`,'error')}}

function attachV4Events(){randomFiveButton?.addEventListener('click',generateRandomFive);for(const control of[elements.platformFilter,elements.genreFilter,elements.yearFromFilter,elements.yearToFilter,elements.ratingFilter,elements.reviewsFilter,elements.ratedOnlyFilter,elements.hideSavedFilter,elements.sortSelect]){control.addEventListener('change',renderGames);if(control.matches('input[type=number]'))control.addEventListener('input',renderGames)}elements.searchInput.addEventListener('input',()=>{clearTimeout(searchDebounceV4);const q=elements.searchInput.value.trim();if(q.length>=3)searchDebounceV4=setTimeout(()=>searchGames(q),550)})}

async function initV4(){patchV4Dom();await loadState();bindEvents();attachV4Events();const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;document.documentElement.classList.toggle('reduce-motion',state.settings.reduceMotion||reduced);updateSavedCount();renderGames();setSourceState('loading','ЗАВАНТАЖЕННЯ');await loadInitialGames();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{})}
