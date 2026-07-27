const v4Script=document.createElement("script");
v4Script.src="./app-v4.js";
v4Script.defer=true;
v4Script.onload=()=>initV4().catch(error=>{console.error(error);setSourceState("error","ПОМИЛКА ЗАПУСКУ");setFeedback("Save Slot не вдалося запустити.","error")});
v4Script.onerror=()=>{setSourceState("error","ПОМИЛКА ЗАПУСКУ");setFeedback("Не вдалося завантажити оновлення Save Slot.","error")};
document.head.append(v4Script);
