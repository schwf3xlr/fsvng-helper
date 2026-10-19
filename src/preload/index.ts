import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppApi } from '../shared/api'

function subscribe<T>(channel: string) {
  return (cb: (payload: T) => void) => {
    const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

// Один API на оба окна: большое окно приложения и панель поверх игры
const api: AppApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: subscribe(IPC.state),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  patchSettings: (patch) => ipcRenderer.send(IPC.patchSettings, patch),
  getLaw: (id) => ipcRenderer.invoke(IPC.getLaw, id),
  refreshLaws: () => ipcRenderer.invoke(IPC.refreshLaws),
  runBind: (id) => ipcRenderer.send(IPC.runBind, id),
  stopBind: () => ipcRenderer.send(IPC.stopBind),
  setHotkeyCapture: (active) => ipcRenderer.send(IPC.hotkeyCapture, active),
  windowAction: (action) => ipcRenderer.send(IPC.windowAction, action),
  setTab: (tab) => ipcRenderer.send(IPC.setTab, tab),
  panelAction: (mode) => ipcRenderer.send(IPC.panelAction, mode),
  setPanelMouse: (over) => ipcRenderer.send(IPC.panelMouse, over),
  exportPack: () => ipcRenderer.invoke(IPC.exportPack),
  importPack: () => ipcRenderer.invoke(IPC.importPack),
  openExternal: (url) => ipcRenderer.send(IPC.openExternal, url),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text),
  checkUpdates: () => ipcRenderer.send(IPC.checkUpdates),
  installUpdate: () => ipcRenderer.send(IPC.installUpdate),
  restartAsAdmin: () => ipcRenderer.send(IPC.restartAsAdmin),
  onToast: subscribe(IPC.toast)
}

contextBridge.exposeInMainWorld('api', api)
