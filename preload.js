const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        getGeojsonFiles: () => ipcRenderer.invoke('getGeojsonFiles'),
        saveGeocodingResults: (data) => ipcRenderer.invoke('saveGeocodingResults', data),
        onGeocodingProgress: (callback) => {
            ipcRenderer.on('geocoding-progress', (event, data) => callback(data));
        },
        onGeocodingComplete: (callback) => {
            ipcRenderer.on('geocoding-complete', (event, data) => callback(data));
        }
    }
);

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  } 
  
  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})
