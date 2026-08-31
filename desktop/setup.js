const api = window.stardewDesktop;
const gamePath = document.querySelector("#game-path");
const savePath = document.querySelector("#save-path");
const progress = document.querySelector("#progress");
const finish = document.querySelector("#finish");
const platform = document.querySelector("#platform");
const platformHelp = document.querySelector("#platform-help");
let setupState;

function addSave(save) {
  const option = document.createElement("option");
  option.value = save.path;
  option.textContent = `${save.name}${save.farmer ? ` · ${save.farmer}` : ""}`;
  savePath.append(option);
}

function showPlatformGuide(changePath = false) {
  if (!setupState) return;
  platformHelp.textContent = setupState.platformGuides[platform.value];
  const detected = setupState.platformInstalls[platform.value];
  if (changePath && detected) gamePath.value = detected;
}

api.getSetupState().then(state => {
  setupState = state;
  document.querySelector("#app-version").textContent = `Version ${state.version}`;
  if (state.development) {
    document.title = "Maglucen Companion Development Settings";
    document.querySelector("#setup-environment").textContent = "Development build · isolated from the installed application.";
  }
  if (state.config) {
    document.querySelector("#setup-kicker").textContent = "SETTINGS";
    document.querySelector("#setup-title").textContent = "Farm & app behavior";
    finish.textContent = "Save settings";
  }
  platform.value = state.suggestedPlatform;
  gamePath.value = state.suggestedInstall;
  state.saves.forEach(addSave);
  if (state.suggestedSave && !state.saves.some(save => save.path === state.suggestedSave)) addSave({ name: "Selected save", path: state.suggestedSave });
  savePath.value = state.suggestedSave;
  document.querySelector("#auto-launch").checked = state.config?.autoLaunch !== false;
  document.querySelector("#close-to-tray").checked = state.config?.closeToTray !== false;
  document.querySelector("#follow-active-save").checked = state.config?.autoFollowActiveSave !== false;
  document.querySelector("#game-status").textContent = state.installs.length ? `${state.installs.length} found` : "Choose folder";
  document.querySelector("#save-status").textContent = state.saves.length ? `${state.saves.length} found` : "Choose save";
  document.querySelector("#smapi-status").textContent = state.smapiDetected ? "SMAPI detected" : "Optional";
  document.querySelector(".smapi-links").hidden = state.smapiDetected;
  showPlatformGuide();
});

platform.addEventListener("change", () => showPlatformGuide(true));
document.querySelector("#browse-game").addEventListener("click", async () => { const path = await api.chooseGame(); if (path) gamePath.value = path; });
document.querySelector("#browse-save").addEventListener("click", async () => { const path = await api.chooseSave(); if (path) { addSave({ name: path.split(/[\\/]/).at(-1), path }); savePath.value = path; } });
api.onProgress(message => { progress.textContent = message; progress.classList.add("visible"); });

document.querySelector("#setup-form").addEventListener("submit", async event => {
  event.preventDefault();
  finish.disabled = true; finish.textContent = "Preparing…";
  progress.textContent = "Validating your installation and save…"; progress.classList.add("visible", "working");
  try {
    await api.completeSetup({ stardewPath: gamePath.value, savePath: savePath.value, platform: platform.value, autoLaunch: document.querySelector("#auto-launch").checked, closeToTray: document.querySelector("#close-to-tray").checked, autoFollowActiveSave: document.querySelector("#follow-active-save").checked });
  } catch (error) {
    progress.textContent = error.message || String(error); progress.classList.remove("working"); progress.classList.add("error");
    finish.disabled = false; finish.textContent = "Try again";
  }
});
