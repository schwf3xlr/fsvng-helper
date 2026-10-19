import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppApi, type OverlayApi } from '../shared/api'

function subscribe<T>(channel: string) {
  return (cb: (payload: T) => void) => {
    const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

const api: AppApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: subscribe(IPC.state),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  getLaw: (id) => ipcRenderer.invoke(IPC.getLaw, id),
  refreshLaws: () => ipcRenderer.invoke(IPC.refreshLaws),
  runBind: (id) => ipcRenderer.send(IPC.runBind, id),
  stopBind: () => ipcRenderer.send(IPC.stopBind),
  setHotkeyCapture: (active) => ipcRenderer.send(IPC.hotkeyCapture, active),
  windowAction: (action) => ipcRenderer.send(IPC.windowAction, action),
  setTab: (tab) => ipcRenderer.send(IPC.setTab, tab),
  exportPack: () => ipcRenderer.invoke(IPC.exportPack),
  importPack: () => ipcRenderer.invoke(IPC.importPack),
  openExternal: (url) => ipcRenderer.send(IPC.openExternal, url),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text),
  checkUpdates: () => ipcRenderer.send(IPC.checkUpdates),
  installUpdate: () => ipcRenderer.send(IPC.installUpdate)
}

const overlay: OverlayApi = {
  onToast: subscribe(IPC.overlayToast),
  onAccent: subscribe(IPC.overlayAccent),
  ready: () => ipcRenderer.send(IPC.overlayReady)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('overlay', overlay)
