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

  loadScript("./app-v4.js?v=11")
    .then(() => loadScript("./app-v5.js?v=11"))
    .then(() => loadScript("./app-v6.js?v=11"))
    .then(() => loadScript("./app-v7.js?v=11"))
    .then(() => loadScript("./app-v8.js?v=11"))
    .then(() => loadScript("./app-v9.js?v=11"))
    .catch(error => {
      console.error(error);
      setSourceState("error", "ПОМИЛКА ЗАПУСКУ");
      setFeedback("Не вдалося завантажити актуальний рушій Save Slot.", "error");
    });
})();