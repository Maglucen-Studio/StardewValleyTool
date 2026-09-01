const api = window.stardewDesktop;
const gamePath = document.querySelector("#game-path");
const savePath = document.querySelector("#save-path");
const progress = document.querySelector("#progress");
const finish = document.querySelector("#finish");
const platform = document.querySelector("#platform");
const platformHelp = document.querySelector("#platform-help");
const languageMode = document.querySelector("#language-mode");
let setupState;
let activeLanguage = "en";

function translator(language = activeLanguage) {
  const catalogs = setupState?.localization?.catalogs || {};
  return (key, variables = {}) => {
    const template = catalogs[language]?.[key] ?? catalogs.en?.[key] ?? key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
      Object.hasOwn(variables, name) ? String(variables[name]) : match,
    );
  };
}

function languageForMode(mode) {
  if (mode === "es") return "es";
  if (mode === "en") return "en";
  return setupState?.localization?.gameCode === "es" ? "es" : "en";
}

function gameLanguageLabel(language) {
  const locale = language === "es" ? "es-ES" : "en-US";
  try {
    return new Intl.DisplayNames([locale], { type: "language" })
      .of(setupState?.localization?.gameCode || "en");
  } catch {
    return setupState?.localization?.gameCode || "en";
  }
}

function applyLanguage(mode) {
  activeLanguage = languageForMode(mode);
  const t = translator();
  document.documentElement.lang = activeLanguage;
  document.title = t("setup.documentTitle");
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  languageMode.querySelector('option[value="game"]').textContent = t(
    "setup.languageGame",
    { language: gameLanguageLabel(activeLanguage) },
  );
  document.querySelector("#app-version").textContent = t("common.version", {
    version: setupState.version,
  });
  if (setupState.development) {
    document.title = `Maglucen Companion ${t("window.settings")}`;
    document.querySelector("#setup-environment").textContent = t("setup.development");
  }
  if (setupState.config) {
    document.querySelector("#setup-kicker").textContent = t("setup.settings");
    document.querySelector("#setup-title").textContent = t("setup.behavior");
    finish.textContent = t("setup.saveSettings");
  }
  updateDetectionStatus();
  showPlatformGuide();
}

function addSave(save) {
  const option = document.createElement("option");
  option.value = save.path;
  option.textContent = `${save.name}${save.farmer ? ` · ${save.farmer}` : ""}`;
  savePath.append(option);
}

function showPlatformGuide(changePath = false) {
  if (!setupState) return;
  platformHelp.textContent = translator()(`setup.guide.${platform.value}`);
  const detected = setupState.platformInstalls[platform.value];
  if (changePath && detected) gamePath.value = detected;
}

function updateDetectionStatus() {
  if (!setupState) return;
  const t = translator();
  document.querySelector("#game-status").textContent = setupState.installs.length
    ? t("setup.found", { count: setupState.installs.length })
    : t("setup.chooseFolder");
  document.querySelector("#save-status").textContent = setupState.saves.length
    ? t("setup.found", { count: setupState.saves.length })
    : t("setup.chooseSave");
  document.querySelector("#smapi-status").textContent = setupState.smapiDetected
    ? t("setup.smapiDetected")
    : t("common.optional");
}

api.getSetupState().then(state => {
  setupState = state;
  platform.value = state.suggestedPlatform;
  gamePath.value = state.suggestedInstall;
  state.saves.forEach(addSave);
  if (state.suggestedSave && !state.saves.some(save => save.path === state.suggestedSave))
    addSave({ name: translator(state.localization.language)("setup.selectedSave"), path: state.suggestedSave });
  savePath.value = state.suggestedSave;
  languageMode.value = state.config?.languageMode || "game";
  document.querySelector("#auto-launch").checked = state.config?.autoLaunch !== false;
  document.querySelector("#close-to-tray").checked = state.config?.closeToTray !== false;
  document.querySelector("#follow-active-save").checked = state.config?.autoFollowActiveSave !== false;
  document.querySelector(".smapi-links").hidden = state.smapiDetected;
  applyLanguage(languageMode.value);
});

languageMode.addEventListener("change", () => applyLanguage(languageMode.value));
platform.addEventListener("change", () => showPlatformGuide(true));
document.querySelector("#browse-game").addEventListener("click", async () => {
  const path = await api.chooseGame();
  if (path) gamePath.value = path;
});
document.querySelector("#browse-save").addEventListener("click", async () => {
  const path = await api.chooseSave();
  if (path) {
    addSave({ name: path.split(/[\\/]/).at(-1), path });
    savePath.value = path;
  }
});
api.onProgress(message => {
  progress.textContent = message;
  progress.classList.add("visible");
});

document.querySelector("#setup-form").addEventListener("submit", async event => {
  event.preventDefault();
  const t = translator();
  finish.disabled = true;
  finish.textContent = t("setup.preparing");
  progress.textContent = t("setup.validating");
  progress.classList.add("visible", "working");
  try {
    await api.completeSetup({
      stardewPath: gamePath.value,
      savePath: savePath.value,
      platform: platform.value,
      languageMode: languageMode.value,
      autoLaunch: document.querySelector("#auto-launch").checked,
      closeToTray: document.querySelector("#close-to-tray").checked,
      autoFollowActiveSave: document.querySelector("#follow-active-save").checked,
    });
  } catch (error) {
    progress.textContent = error.message || String(error);
    progress.classList.remove("working");
    progress.classList.add("error");
    finish.disabled = false;
    finish.textContent = t("common.tryAgain");
  }
});
