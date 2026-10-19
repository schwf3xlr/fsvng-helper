// Контракт между main-процессом и окнами (через preload)
import type { LawDoc, LawId } from './laws'
import type { Settings } from './settings'

export type WindowMode = 'active' | 'glass' | 'hidden'

export type TabId = 'binds' | 'memos' | 'laws' | 'settings'

export interface GameStatus {
  /** Активное окно — GTA */
  active: boolean
  /** Что сейчас на переднем плане (для диагностики) */
  foregroundExe: string
  /** Windows сообщает о полноэкранном Direct3D — оверлей поверх игры не виден */
  fullscreen: boolean
  /** Хоть раз видели полноэкранный режим за этот запуск */
  fullscreenSeen: boolean
}

export interface LawMeta {
  id: LawId
  title: string
  fetchedAt?: string
  editedAt?: string
  articles: number
  error?: string
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error' | 'unsupported'
  version?: string
  progress?: number
  message?: string
}

export interface AppState {
  settings: Settings
  game: GameStatus
  mode: WindowMode
  /** Какую вкладку открыть (меняет main, например по хоткею памяток) */
  tab: TabId | null
  laws: LawMeta[]
  lawsLoading: boolean
  runningBind: string | null
  update: UpdateStatus
  version: string
  settingsErrors: string[]
}

export interface PackImportResult {
  binds: number
  checklists: number
}

/** То, что окно приложения может попросить у main */
export interface AppApi {
  getState(): Promise<AppState>
  onState(cb: (patch: Partial<AppState>) => void): () => void

  saveSettings(settings: Settings): Promise<string[]>

  getLaw(id: LawId): Promise<LawDoc | null>
  refreshLaws(): Promise<void>

  runBind(id: string): void
  stopBind(): void
  /** Пока окно записывает хоткей, глобальные хоткеи выключены */
  setHotkeyCapture(active: boolean): void

  windowAction(action: 'minimize' | 'hide' | 'glass' | 'active'): void
  setTab(tab: TabId): void

  exportPack(): Promise<boolean>
  importPack(): Promise<PackImportResult | null>
  openExternal(url: string): void
  copyText(text: string): void

  checkUpdates(): void
  installUpdate(): void
}

export interface Toast {
  id: string
  kind: 'info' | 'run' | 'ok' | 'warn' | 'error'
  title: string
  text?: string
  /** 0..1 */
  progress?: number
  /** Подсказка справа: «стоп End» */
  hint?: string
  /** мс до скрытия; 0 — не скрывать */
  ttl?: number
}

/** Оверлей поверх игры: только уведомления */
export interface OverlayApi {
  onToast(cb: (t: Toast) => void): () => void
  onAccent(cb: (accent: string) => void): () => void
  ready(): void
}

export const IPC = {
  getState: 'app:get-state',
  state: 'app:state',
  saveSettings: 'app:save-settings',
  getLaw: 'laws:get',
  refreshLaws: 'laws:refresh',
  runBind: 'bind:run',
  stopBind: 'bind:stop',
  hotkeyCapture: 'hotkeys:capture',
  windowAction: 'window:action',
  setTab: 'window:set-tab',
  exportPack: 'pack:export',
  importPack: 'pack:import',
  openExternal: 'shell:open',
  copyText: 'clipboard:copy',
  checkUpdates: 'update:check',
  installUpdate: 'update:install',
  overlayToast: 'overlay:toast',
  overlayAccent: 'overlay:accent',
  overlayReady: 'overlay:ready'
} as const
