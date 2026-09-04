/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stardewDesktop", {
  getLocalization: () => ipcRenderer.invoke("localization:get-state"),
  setLanguageMode: mode => ipcRenderer.invoke("localization:set-mode", String(mode || "")),
  onLocalizationChanged: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("localization:changed", listener);
    return () => ipcRenderer.removeListener("localization:changed", listener);
  },
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  getReleaseNotesState: () => ipcRenderer.invoke("release-notes:get"),
  acknowledgeReleaseNotes: () => ipcRenderer.invoke("release-notes:acknowledge"),
  onUpdateState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
  listFarms: () => ipcRenderer.invoke("farms:list"),
  switchFarm: savePath => ipcRenderer.invoke("farms:switch", String(savePath || "")),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics:get"),
  copyText: value => ipcRenderer.invoke("clipboard:write", String(value || "")),
  exportFarm: () => ipcRenderer.invoke("farm:export"),
  setDisplayScale: scale => ipcRenderer.invoke("display:set-scale", Number(scale)),
  onOpenHelp: callback => {
    const listener = () => callback();
    ipcRenderer.on("help:open", listener);
    return () => ipcRenderer.removeListener("help:open", listener);
  },
  onNavigateHistory: callback => {
    const listener = (_event, direction) => callback(direction === "forward" ? "forward" : "back");
    ipcRenderer.on("navigation:history", listener);
    return () => ipcRenderer.removeListener("navigation:history", listener);
  },
  getSetupState: () => ipcRenderer.invoke("setup:get-state"),
  chooseGame: () => ipcRenderer.invoke("setup:choose-game"),
  chooseSave: () => ipcRenderer.invoke("setup:choose-save"),
  completeSetup: config => ipcRenderer.invoke("setup:complete", {
    stardewPath: String(config?.stardewPath || ""),
    savePath: String(config?.savePath || ""),
    platform: String(config?.platform || "other"),
    autoLaunch: config?.autoLaunch !== false,
    closeToTray: config?.closeToTray !== false,
    autoFollowActiveSave: config?.autoFollowActiveSave !== false,
    languageMode: ["game", "en", "es"].includes(config?.languageMode)
      ? config.languageMode
      : "game",
  }),
  onProgress: callback => {
    const listener = (_event, message) => callback(String(message));
    ipcRenderer.on("setup:progress", listener);
    return () => ipcRenderer.removeListener("setup:progress", listener);
  },
});
