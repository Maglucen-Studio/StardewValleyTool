window.stardewDesktop.getSetupState().then(state => {
  const language = state.localization.language;
  const messages = state.localization.catalogs[language] || state.localization.catalogs.en;
  document.documentElement.lang = language;
  document.querySelector("#loading-title").textContent = messages["loading.title"];
  document.querySelector("#loading-progress").textContent = messages["loading.service"];
});

window.stardewDesktop.onProgress(message => {
  document.querySelector("#loading-progress").textContent = message;
});
