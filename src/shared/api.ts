// Контракт между main-процессом и окнами (через preload)
import type { LawDoc, LawId } from './laws'
import type { Settings } from './settings'

/** Большое окно приложения */
export type WindowMode = 'active' | 'hidden'

/** Панель поверх игры: спрятана, видна (клики идут в игру) или активна (мышь и клавиатура) */
/** layout — расстановка: панель и уведомления перетаскиваются мышью по всему экрану */
export type PanelMode = 'hidden' | 'passive' | 'interactive' | 'layout'

export type TabId = 'binds' | 'memos' | 'laws' | 'checklists' | 'settings'

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
  panel: PanelMode
  /** Какую вкладку открыть (меняет main) */
  tab: TabId | null
  laws: LawMeta[]
  lawsLoading: boolean
  runningBind: string | null
  update: UpdateStatus
  version: string
  /** Приложение запущено с правами администратора */
  elevated: boolean
  settingsErrors: string[]
}

export interface PackImportResult {
  binds: number
  checklists: number
}

/** То, что окна могут попросить у main */
export interface AppApi {
  getState(): Promise<AppState>
  onState(cb: (patch: Partial<AppState>) => void): () => void

  /** Полное сохранение (вкладка «Настройки», редактор). Возвращает ошибки клавиш */
  saveSettings(settings: Settings): Promise<string[]>
  /** Правка отдельных разделов (избранное, отметки, калькулятор, положение панели) */
  patchSettings(patch: Partial<Settings>): void

  getLaw(id: LawId): Promise<LawDoc | null>
  refreshLaws(): Promise<void>

  runBind(id: string): void
  stopBind(): void
  /** Пока окно записывает хоткей, глобальные хоткеи выключены */
  setHotkeyCapture(active: boolean): void

  windowAction(action: 'minimize' | 'maximize' | 'hide' | 'active'): void
  setTab(tab: TabId): void

  panelAction(mode: PanelMode): void
  /** Курсор над панелью: в активном режиме клики мимо неё уходят в игру */
  setPanelMouse(over: boolean): void

  exportPack(): Promise<boolean>
  importPack(): Promise<PackImportResult | null>
  openExternal(url: string): void
  copyText(text: string): void

  checkUpdates(): void
  installUpdate(): void
  /** Перезапуск с правами администратора (если запустили без них) */
  restartAsAdmin(): void

  onToast(cb: (t: Toast) => void): () => void
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

export const IPC = {
  getState: 'app:get-state',
  state: 'app:state',
  saveSettings: 'app:save-settings',
  patchSettings: 'app:patch-settings',
  getLaw: 'laws:get',
  refreshLaws: 'laws:refresh',
  runBind: 'bind:run',
  stopBind: 'bind:stop',
  hotkeyCapture: 'hotkeys:capture',
  windowAction: 'window:action',
  setTab: 'window:set-tab',
  panelAction: 'panel:action',
  panelMouse: 'panel:mouse',
  exportPack: 'pack:export',
  importPack: 'pack:import',
  openExternal: 'shell:open',
  copyText: 'clipboard:copy',
  checkUpdates: 'update:check',
  installUpdate: 'update:install',
  restartAsAdmin: 'app:restart-admin',
  toast: 'overlay:toast'
} as const
