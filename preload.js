const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nutritionAPI', {
  searchFood: (foodName) => ipcRenderer.invoke('food:search', foodName)
});
