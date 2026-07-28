(function loadCurrentEngine() {
  let finalStartup = null;

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

  function holdStartup() {
    const deferred = async function deferredStartup() {
      window.__saveSlotStartupWasRequested = true;
    };
    Object.defineProperty(window, "loadInitialGames", {
      configurable: true,
      get() { return deferred; },
      set(value) { if (typeof value === "function") finalStartup = value; }
    });
  }

  async function releaseStartup() {
    delete window.loadInitialGames;
    if (typeof finalStartup !== "function") throw new Error("Android-модуль не надав функцію оновлення бази");
    window.loadInitialGames = finalStartup;
    await window.loadInitialGames();
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
    .then(() => {
      holdStartup();
      return loadScript("./app-v5.js?v=16");
    })
    .then(() => loadScript("./app-v6.js?v=16"))
    .then(() => loadScript("./app-v7.js?v=16"))
    .then(() => loadScript("./app-v8.js?v=16"))
    .then(() => loadScript("./app-v9.js?v=16"))
    .then(() => loadScript("./app-v10.js?v=16"))
    .then(() => loadScript("./app-v11.js?v=16"))
    .then(() => loadScript("./app-v12.js?v=16"))
    .then(() => loadScript("./app-v13.js?v=16"))
    .then(releaseStartup)
    .catch(error => {
      console.error(error);
      setLoading(false);
      setSourceState("error", "ПОМИЛКА ЗАПУСКУ");
      setFeedback("Не вдалося завантажити актуальний рушій Save Slot.", "error");
    });
})();