const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hermesBrowser',{request:request=>ipcRenderer.invoke('hermes-browser',request)});
