// Общее состояние для большого окна и панели в игре. Источник правды — main-процесс:
// он присылает изменения, а окна шлют ему правки.
import { create } from 'zustand'
import type { AppApi, AppState, TabId } from '../../../shared/api'
import type { LawDoc, LawId } from '../../../shared/laws'
import type { Settings } from '../../../shared/settings'
import { createMockApi } from './mock'
import { applyAccent } from './theme'

export const api: AppApi = window.api ?? createMockApi()
export const isDemo = !window.api

export type MemoFilter = 'all' | 'fav' | LawId

interface Store {
  app: AppState | null
  tab: TabId
  docs: Partial<Record<LawId, LawDoc>>
  /** Открыть закон на статье (переход из памятки) */
  lawTarget: { law: LawId; number: string; seq: number } | null
  memoQuery: string
  memoFilter: MemoFilter

  init(): Promise<void>
  setTab(tab: TabId): void
  loadLaw(id: LawId): Promise<void>
  openLaw(law: LawId, number: string): void
  openMemo(law: LawId, number: string): void
  setMemoQuery(q: string): void
  setMemoFilter(f: MemoFilter): void
  saveSettings(next: Settings): Promise<string[]>
  /** Мелкие правки — уходят в main только изменённые разделы */
  patchSettings(fn: (s: Settings) => Settings): void
  toggleCalc(key: string): void
  clearCalc(): void
}

export const useStore = create<Store>((set, get) => ({
  app: null,
  tab: 'binds',
  docs: {},
  lawTarget: null,
  memoQuery: '',
  memoFilter: 'fav',

  async init() {
    const app = await api.getState()
    set({ app, memoFilter: app.settings.favorites.length ? 'fav' : 'all' })
    applyAccent(app.settings.ui.accent)
    api.onState((patch) => {
      const prev = get().app
      if (!prev) return
      set({ app: { ...prev, ...patch } })
      if (patch.settings) applyAccent(patch.settings.ui.accent)
      if (patch.tab) get().setTab(patch.tab)
      // Законы обновились на форуме — перечитываем
      if (patch.laws) {
        for (const meta of patch.laws) {
          const doc = get().docs[meta.id]
          if ((doc && meta.fetchedAt && meta.fetchedAt !== doc.fetchedAt) || (!doc && meta.articles > 0)) {
            void get().loadLaw(meta.id)
          }
        }
      }
    })
    for (const meta of app.laws) void get().loadLaw(meta.id)
  },

  setTab(tab) {
    set({ tab })
    api.setTab(tab)
  },

  async loadLaw(id) {
    const doc = await api.getLaw(id)
    if (doc) set((s) => ({ docs: { ...s.docs, [id]: doc } }))
  },

  openLaw(law, number) {
    set((s) => ({ lawTarget: { law, number, seq: (s.lawTarget?.seq ?? 0) + 1 } }))
    get().setTab('laws')
  },

  openMemo(law, number) {
    set({ memoFilter: law, memoQuery: number })
    get().setTab('memos')
  },

  setMemoQuery: (memoQuery) => set({ memoQuery }),
  setMemoFilter: (memoFilter) => set({ memoFilter }),

  saveSettings: (next) => api.saveSettings(next),

  patchSettings(fn) {
    const app = get().app
    if (!app) return
    const prev = app.settings
    const next = fn(prev)
    const patch: Partial<Settings> = {}
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      if (next[key] !== prev[key]) (patch as Record<string, unknown>)[key] = next[key]
    }
    if (Object.keys(patch).length === 0) return
    set({ app: { ...app, settings: next } })
    api.patchSettings(patch)
  },

  toggleCalc(key) {
    get().patchSettings((s) => ({ ...s, calc: s.calc.includes(key) ? s.calc.filter((k) => k !== key) : [...s.calc, key] }))
  },
  clearCalc() {
    get().patchSettings((s) => ({ ...s, calc: [] }))
  }
}))

/** Настройки уже загружены, когда рисуются страницы */
export function useSettings(): Settings {
  return useStore((s) => s.app!.settings)
}
