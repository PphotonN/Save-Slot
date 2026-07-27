function toggleSaved(game) {
  const list = activeList();
  const index = list.items.findIndex(item => item.game.id === game.id);
  if (index >= 0) { list.items.splice(index,1); showToast("Гру видалено зі списку"); }
  else {
    list.items.push({ id:createId("entry"), game:normalizeSavedGame(game), status:"planned", priority:3, personalRating:null, notes:"", order:list.items.length, addedAt:new Date().toISOString() });
    showToast("Гру додано до списку","success");
  }
  list.updatedAt = new Date().toISOString(); persistState(); updateSavedCount(); renderGames();
  if (elements.libraryDialog.open) renderLibrary();
}

function updateSavedCount() { elements.savedCount.textContent = activeList()?.items.length || 0; }
function findCurrentGame(id) { return currentResults.find(game => game.id === id) || state.lists.flatMap(list=>list.items).find(item=>item.game.id===id)?.game; }

function openGame(id) {
  currentGameId = id;
  const game = findCurrentGame(id);
  if (!game) return;
  elements.gameDialogTitle.textContent = game.title;
  renderGameDialog(game);
  elements.gameDialog.showModal();
}

function renderGameDialog(game) {
  const entry = findEntry(game.id);
  const cover = game.cover || game.fallbackCover;
  elements.gameDialogContent.innerHTML = `
    <div class="game-detail-grid">
      <div class="detail-cover">${cover ? `<img src="${escapeHtml(cover)}" alt="Обкладинка ${escapeHtml(game.title)}" onerror="this.style.display='none'" />` : `<div class="detail-fallback">${escapeHtml(initials(game.title))}</div>`}</div>
      <div>
        <div class="detail-badges">${game.year?`<span class="tag">${game.year}</span>`:""}${game.platforms.map(p=>`<span class="tag accent">${escapeHtml(p)}</span>`).join("")}</div>
        <div class="score-panel"><strong>${game.rating ? `${game.rating.percent}%` : "—"}</strong><div><span>РЕЙТИНГ ГРАВЦІВ</span><small>${game.rating ? `${formatNumber(game.rating.total)} Steam-відгуків · надійна межа ${game.rating.trust}%` : "Для цієї гри немає отриманого Steam-рейтингу"}</small></div></div>
        <p class="detail-description">${escapeHtml(game.description || "Опис у Wikidata відсутній.")}</p>
        <div class="detail-links"><a class="text-link" href="${escapeHtml(game.wikidataUrl)}" target="_blank" rel="noreferrer">Wikidata ↗</a>${game.steamUrl?`<a class="text-link" href="${escapeHtml(game.steamUrl)}" target="_blank" rel="noreferrer">Steam ↗</a>`:""}</div>
        ${game.genres.length?`<p class="helper"><strong>Жанри:</strong> ${escapeHtml(game.genres.join(", "))}</p>`:""}
        ${game.developers?.length?`<p class="helper"><strong>Розробники:</strong> ${escapeHtml(game.developers.join(", "))}</p>`:""}
        <button class="pixel-button ${entry?"danger":""}" id="dialogSaveButton" type="button">${entry?"ВИДАЛИТИ ЗІ СПИСКУ":"ДОДАТИ ДО СПИСКУ"}</button>
      </div>
    </div>
    ${entry ? `<div class="entry-form"><label class="control-group"><span>СТАТУС</span><select id="entryStatus">${Object.entries(STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${entry.status===v?"selected":""}>${l}</option>`).join("")}</select></label><label class="control-group"><span>ПРІОРИТЕТ</span><select id="entryPriority">${[1,2,3,4,5].map(v=>`<option ${entry.priority===v?"selected":""}>${v}</option>`).join("")}</select></label><label class="control-group"><span>ОСОБИСТА ОЦІНКА 0–100</span><input id="entryRating" type="number" min="0" max="100" value="${entry.personalRating??""}" /></label><label class="control-group wide"><span>НОТАТКИ</span><textarea id="entryNotes" rows="4">${escapeHtml(entry.notes)}</textarea></label><button class="pixel-button wide" id="saveEntryButton" type="button">ЗБЕРЕГТИ ЗАПИС</button></div>` : ""}`;
  document.getElementById("dialogSaveButton").addEventListener("click",()=>{toggleSaved(game);renderGameDialog(game)});
  document.getElementById("saveEntryButton")?.addEventListener("click",()=>{
    const item=findEntry(game.id); if(!item)return;
    item.status=document.getElementById("entryStatus").value; item.priority=Number(document.getElementById("entryPriority").value);
    item.personalRating=nullableNumber(document.getElementById("entryRating").value); item.notes=document.getElementById("entryNotes").value;
    persistState(); showToast("Запис оновлено","success"); if(elements.libraryDialog.open)renderLibrary();
  });
}

function renderLibrary() {
  const list=activeList();
  elements.listSelect.replaceChildren(...state.lists.map(l=>new Option(l.name,l.id,false,l.id===list.id)));
  elements.listNameInput.value=list.name;
  const completed=list.items.filter(i=>["completed","mastered"].includes(i.status)).length;
  const rated=list.items.filter(i=>i.game.rating).length;
  elements.listStats.innerHTML=[[list.items.length,"ІГОР"],[list.items.filter(i=>i.status==="playing").length,"ГРАЮ"],[completed,"ЗАВЕРШЕНО"],[rated,"З STEAM-ОЦІНКОЮ"]].map(([v,l])=>`<div class="stat-card"><strong>${v}</strong><span>${l}</span></div>`).join("");
  let items=[...list.items];
  if(elements.libraryStatus.value!=="all")items=items.filter(i=>i.status===elements.libraryStatus.value);
  const sort=elements.librarySort.value;
  items.sort((a,b)=>sort==="priority"?b.priority-a.priority:sort==="status"?a.status.localeCompare(b.status):sort==="rating"?(b.personalRating??b.game.rating?.percent??0)-(a.personalRating??a.game.rating?.percent??0):sort==="title"?a.game.title.localeCompare(b.game.title,"uk"):a.order-b.order);
  elements.savedList.replaceChildren(); elements.emptyLibrary.hidden=items.length>0;
  for(const item of items){
    const row=document.createElement("article"); row.className="saved-item";
    const cover=item.game.cover||item.game.fallbackCover;
    row.innerHTML=`<button class="saved-cover" type="button">${cover?`<img src="${escapeHtml(cover)}" alt="" />`:`<span>${escapeHtml(initials(item.game.title))}</span>`}</button><div class="saved-copy"><h3>${escapeHtml(item.game.title)}</h3><p>${item.game.rating?`${item.game.rating.percent}% · ${formatNumber(item.game.rating.total)} відгуків`:"без Steam-рейтингу"}</p><textarea rows="2" placeholder="Нотатка...">${escapeHtml(item.notes)}</textarea></div><label class="mini-control"><span>СТАТУС</span><select>${Object.entries(STATUS_LABELS).map(([v,l])=>`<option value="${v}" ${item.status===v?"selected":""}>${l}</option>`).join("")}</select></label><label class="mini-control"><span>ПРІОРИТЕТ</span><select>${[1,2,3,4,5].map(v=>`<option ${item.priority===v?"selected":""}>${v}</option>`).join("")}</select></label><div class="row-actions"><button class="up">↑</button><button class="down">↓</button><button class="remove-button">×</button></div>`;
    row.querySelector(".saved-cover").addEventListener("click",()=>openGame(item.game.id));
    row.querySelector("textarea").addEventListener("change",e=>{item.notes=e.target.value;persistState()});
    const selects=row.querySelectorAll("select"); selects[0].addEventListener("change",e=>{item.status=e.target.value;persistState();renderLibrary()}); selects[1].addEventListener("change",e=>{item.priority=Number(e.target.value);persistState();renderLibrary()});
    row.querySelector(".remove-button").addEventListener("click",()=>toggleSaved(item.game)); row.querySelector(".up").addEventListener("click",()=>moveItem(item.id,-1)); row.querySelector(".down").addEventListener("click",()=>moveItem(item.id,1));
    elements.savedList.append(row);
  }
  updateSavedCount();
}

function moveItem(id,delta){const list=activeList(),index=list.items.findIndex(i=>i.id===id),target=index+delta;if(index<0||target<0||target>=list.items.length)return;[list.items[index],list.items[target]]=[list.items[target],list.items[index]];list.items.forEach((i,n)=>i.order=n);persistState();renderLibrary()}
function newList(){const name=prompt("Назва нового списку:","Новий список");if(!name?.trim())return;const list=createList(name.trim());state.lists.push(list);state.activeListId=list.id;persistState();renderLibrary();renderGames()}
function duplicateList(){const source=activeList(),copy=createList(`${source.name} — копія`);copy.items=source.items.map((i,n)=>({...structuredClone(i),id:createId("entry"),order:n}));state.lists.push(copy);state.activeListId=copy.id;persistState();renderLibrary();renderGames()}
function deleteList(){if(state.lists.length<=1)return showToast("Має залишитися хоча б один список","error");if(!confirm(`Видалити список «${activeList().name}»?`))return;state.lists=state.lists.filter(l=>l.id!==state.activeListId);state.activeListId=state.lists[0].id;persistState();renderLibrary();renderGames()}

function download(filename,content){const blob=new Blob([content],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportData(scope="all"){const data=scope==="active"?{...state,lists:[structuredClone(activeList())],activeListId:activeList().id}:structuredClone(state);download(scope==="active"?`${slug(activeList().name)}.json`:"save-slot-backup.json",JSON.stringify(data,null,2))}
function slug(v){return normalizeText(v).replace(/\s+/g,"-")||"save-slot"}
function mergeStates(base,incoming){const out=sanitizeState(base),other=sanitizeState(incoming);for(const list of other.lists){const existing=out.lists.find(l=>l.id===list.id);if(existing){const ids=new Set(existing.items.map(i=>i.id));existing.items.push(...list.items.filter(i=>!ids.has(i.id)))}else out.lists.push(list)}return out}

function resetFilters(){elements.platformFilter.value="all";elements.genreFilter.value="all";elements.yearFromFilter.value="";elements.yearToFilter.value="";elements.ratingFilter.value="0";elements.reviewsFilter.value="0";elements.ratedOnlyFilter.checked=false;elements.hideSavedFilter.checked=false;elements.sortSelect.value="relevance";renderGames()}
function renderSettings(){elements.steamRatingsSetting.checked=state.settings.steamRatings;elements.reduceMotionSetting.checked=state.settings.reduceMotion;elements.tiltSetting.value=state.settings.tiltStrength}

function bindEvents(){
  elements.searchForm.addEventListener("submit",e=>{e.preventDefault();const q=elements.searchInput.value.trim();if(q)searchGames(q)});
  for(const el of [elements.platformFilter,elements.genreFilter,elements.yearFromFilter,elements.yearToFilter,elements.ratingFilter,elements.reviewsFilter,elements.ratedOnlyFilter,elements.hideSavedFilter,elements.sortSelect])el.addEventListener("input",renderGames);
  elements.resetFilters.addEventListener("click",resetFilters);
  elements.libraryButton.addEventListener("click",()=>{renderLibrary();elements.libraryDialog.showModal()});
  elements.settingsButton.addEventListener("click",()=>{renderSettings();elements.settingsDialog.showModal()});
  document.querySelectorAll(".close-dialog").forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach(dialog=>dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()}));
  elements.listSelect.addEventListener("change",()=>{state.activeListId=elements.listSelect.value;persistState();renderLibrary();renderGames()});
  elements.listNameInput.addEventListener("change",()=>{activeList().name=elements.listNameInput.value.trim()||"Без назви";persistState();renderLibrary()});
  elements.newListButton.addEventListener("click",newList);elements.duplicateListButton.addEventListener("click",duplicateList);elements.deleteListButton.addEventListener("click",deleteList);elements.libraryStatus.addEventListener("change",renderLibrary);elements.librarySort.addEventListener("change",renderLibrary);
  elements.exportButton.addEventListener("click",()=>exportData("all"));elements.exportAllButton.addEventListener("click",()=>exportData("all"));elements.exportActiveButton.addEventListener("click",()=>exportData("active"));
  elements.importButton.addEventListener("click",()=>elements.importInput.click());elements.importInput.addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{pendingImport=sanitizeState(JSON.parse(await file.text()));elements.importSummary.textContent=`Списків: ${pendingImport.lists.length}; ігор: ${pendingImport.lists.reduce((s,l)=>s+l.items.length,0)}.`;elements.importDialog.showModal()}catch(error){showToast(`Помилка імпорту: ${error.message}`,"error")}finally{e.target.value=""}});
  elements.importReplaceButton.addEventListener("click",()=>{state=pendingImport;pendingImport=null;persistState();elements.importDialog.close();updateSavedCount();renderGames();showToast("Дані замінено","success")});
  elements.importMergeButton.addEventListener("click",()=>{state=mergeStates(state,pendingImport);pendingImport=null;persistState();elements.importDialog.close();updateSavedCount();renderGames();showToast("Дані об’єднано","success")});
  elements.importCancelButton.addEventListener("click",()=>{pendingImport=null;elements.importDialog.close()});
  elements.settingsForm.addEventListener("submit",e=>{e.preventDefault();state.settings.steamRatings=elements.steamRatingsSetting.checked;state.settings.reduceMotion=elements.reduceMotionSetting.checked;state.settings.tiltStrength=Number(elements.tiltSetting.value);document.documentElement.classList.toggle("reduce-motion",state.settings.reduceMotion);persistState();elements.settingsDialog.close();showToast("Параметри збережено","success")});
  elements.resetAppButton.addEventListener("click",()=>{if(!confirm("Видалити всі списки, нотатки та налаштування?"))return;state=createState();persistState();updateSavedCount();elements.settingsDialog.close();renderGames();showToast("Локальні дані скинуто")});
}
