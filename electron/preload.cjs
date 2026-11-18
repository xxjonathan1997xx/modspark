const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('modSpark', {
  scanGames: () => ipcRenderer.invoke('games:scan'),
  cachedGames: () => ipcRenderer.invoke('games:cached'),
  onInstallProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('catalog:progress', listener)
    return () => ipcRenderer.removeListener('catalog:progress', listener)
  },
  openFolder: (folderPath) => ipcRenderer.invoke('system:open-folder', folderPath),
  systemInfo: () => ipcRenderer.invoke('system:info'),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  catalog: {
    getState: () => ipcRenderer.invoke('catalog:get-state'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
    addSource: (url, publicKey) => ipcRenderer.invoke('catalog:add-source', { url, publicKey }),
    removeSource: (id) => ipcRenderer.invoke('catalog:remove-source', id),
    install: (sourceId, packageId) => ipcRenderer.invoke('catalog:install', { sourceId, packageId }),
    uninstall: (id) => ipcRenderer.invoke('catalog:uninstall', id),
    launch: (id) => ipcRenderer.invoke('catalog:launch', id),
    installPrerequisite: (sourceId, id) => ipcRenderer.invoke('catalog:install-prerequisite', { sourceId, id }),
  },
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('updates:state', listener)
    return () => ipcRenderer.removeListener('updates:state', listener)
  },
})
