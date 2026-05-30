const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisElectron', {
    closeApp: () => ipcRenderer.send('app-close'),
    launchApp: (appName) => ipcRenderer.invoke('launch-app', appName),
    isElectron: true
});
