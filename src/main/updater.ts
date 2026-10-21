// Автообновление через GitHub Releases (electron-updater).
// Работает только в установленной версии; в режиме разработки — 'unsupported'.
import { app } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import adapterModule from 'electron-updater/out/ElectronAppAdapter'
import { existsSync, statfsSync } from 'node:fs'
import { join, parse } from 'node:path'
import type { UpdateStatus } from '../shared/api'

const { autoUpdater, NsisUpdater } = electronUpdater
const { ElectronAppAdapter } = adapterModule

/** app-update.yml кладёт electron-builder, если в сборке настроен publish (GitHub Releases) */
const updatesConfigured = () => app.isPackaged && existsSync(join(process.resourcesPath, 'app-update.yml'))

function freeMb(path: string): number {
  try {
    const s = statfsSync(path)
    return (s.bavail * s.bsize) / 1048576
  } catch {
    return Infinity
  }
}

/**
 * Обновления качаются в профиль пользователя на диске C. Если там меньше 1 ГБ, а
 * программа стоит на другом диске — качаем рядом с ней, иначе обновление не поместится.
 */
function cacheOnInstallDrive(): string | null {
  const local = process.env.LOCALAPPDATA
  if (!local) return null
  const root = parse(process.execPath).root
  if (root.toLowerCase() === parse(local).root.toLowerCase() || freeMb(local) >= 1024) return null
  return join(root, 'ФСВНГ Helper — обновления')
}

class InstallDriveAdapter extends ElectronAppAdapter {
  constructor(private readonly base: string) {
    super()
  }
  override get baseCachePath(): string {
    return this.base
  }
}

function createUpdater(): AppUpdater {
  const base = cacheOnInstallDrive()
  return base ? new NsisUpdater(undefined, new InstallDriveAdapter(base)) : autoUpdater
}

export class Updater {
  status: UpdateStatus = { state: updatesConfigured() ? 'idle' : 'unsupported' }
  private readonly updater: AppUpdater | null = null

  constructor(private readonly onChange: (s: UpdateStatus) => void) {
    if (!updatesConfigured()) return
    const u = createUpdater()
    this.updater = u
    u.autoDownload = true
    u.autoInstallOnAppQuit = true
    u.on('checking-for-update', () => this.set({ state: 'checking' }))
    u.on('update-available', (info) => this.set({ state: 'available', version: info.version }))
    u.on('update-not-available', () => this.set({ state: 'none' }))
    u.on('download-progress', (p) => this.set({ state: 'downloading', version: this.status.version, progress: p.percent / 100 }))
    u.on('update-downloaded', (info) => this.set({ state: 'ready', version: info.version }))
    u.on('error', (e) => this.set({ state: 'error', message: e?.message ?? String(e) }))
  }

  private set(s: UpdateStatus): void {
    this.status = s
    this.onChange(s)
  }

  check(): void {
    this.updater?.checkForUpdates().catch((e: Error) => this.set({ state: 'error', message: e.message }))
  }

  install(): void {
    if (this.status.state === 'ready') this.updater?.quitAndInstall()
  }
}
