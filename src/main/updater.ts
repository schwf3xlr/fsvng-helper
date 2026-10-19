// Автообновление через GitHub Releases (electron-updater).
// Работает только в установленной версии; в режиме разработки — 'unsupported'.
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateStatus } from '../shared/api'

const { autoUpdater } = electronUpdater

/** app-update.yml кладёт electron-builder, если в сборке настроен publish (GitHub Releases) */
const updatesConfigured = () => app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))

export class Updater {
  status: UpdateStatus = { state: updatesConfigured() ? 'idle' : 'unsupported' }

  constructor(private readonly onChange: (s: UpdateStatus) => void) {
    if (!updatesConfigured()) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => this.set({ state: 'available', version: info.version }))
    autoUpdater.on('update-not-available', () => this.set({ state: 'none' }))
    autoUpdater.on('download-progress', (p) =>
      this.set({ state: 'downloading', version: this.status.version, progress: p.percent / 100 })
    )
    autoUpdater.on('update-downloaded', (info) => this.set({ state: 'ready', version: info.version }))
    autoUpdater.on('error', (e) => this.set({ state: 'error', message: e?.message ?? String(e) }))
  }

  private set(s: UpdateStatus): void {
    this.status = s
    this.onChange(s)
  }

  check(): void {
    if (!updatesConfigured()) return
    autoUpdater.checkForUpdates().catch((e: Error) => this.set({ state: 'error', message: e.message }))
  }

  install(): void {
    if (this.status.state === 'ready') autoUpdater.quitAndInstall()
  }
}
