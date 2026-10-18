// Exposes only the save function to the page; no other Node or Electron access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("syrumDesktop", {
  save: (name, bytes) => ipcRenderer.invoke("syrum:save", name, bytes),
});
