(function loadCurrentEngine() {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Не вдалося завантажити ${src}`));
      document.head.append(script);
    });
  }

  async function loadScriptWithoutAutoInit(src) {
    const response = await fetch(src, { cache: "no-store" });
    if (!response.ok) throw new Error(`Не вдалося завантажити ${src}: HTTP ${response.status}`);
    const source = await response.text();
    const marker = "\ninitV5().catch(error => {";
    const markerIndex = source.lastIndexOf(marker);
    if (markerIndex < 0) throw new Error("Не знайдено точку автоматичного запуску app-v5.js");
    const script = document.createElement("script");
    script.textContent = `${source.slice(0, markerIndex)}\n//# sourceURL=${src}`;
    document.head.append(script);
  }

  function loadStyle(src) {
    return new Promise(resolve => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = src;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    });
  }

  loadStyle("./styles-v10.css?v=16");
  loadScript("./app-v4.js?v=16")
    .then(() => loadScriptWithoutAutoInit("./app-v5.js?v=16"))
    .then(() => loadScript("./app-v6.js?v=16"))
    .then(() => loadScript("./app-v7.js?v=16"))
    .then(() => loadScript("./app-v8.js?v=16"))
    .then(() => loadScript("./app-v9.js?v=16"))
    .then(() => loadScript("./app-v10.js?v=16"))
    .then(() => loadScript("./app-v11.js?v=16"))
    .then(() => loadScript("./app-v12.js?v=16"))
    .then(() => loadScript("./app-v13.js?v=16"))
    .catch(error => {
      console.error(error);
      setSourceState("error", "ПОМИЛКА ЗАПУСКУ");
      setFeedback("Не вдалося завантажити актуальний рушій Save Slot.", "error");
    });
})();