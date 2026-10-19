import { create } from 'zustand'
import type { AppApi, AppState, TabId } from '../../../shared/api'
import type { LawDoc, LawId } from '../../../shared/laws'
import type { Settings } from '../../../shared/settings'
import { createMockApi } from './mock'

export const api: AppApi = window.api ?? createMockApi()
export const isDemo = !window.api

export type MemoFilter = 'all' | 'fav' | LawId | 'checklists'

interface Store {
  app: AppState | null
  tab: TabId
  docs: Partial<Record<LawId, LawDoc>>
  /** Открыть закон на статье (после перехода из памятки) */
  lawTarget: { law: LawId; number: string; seq: number } | null
  memoQuery: string
  memoFilter: MemoFilter
  /** Части статей в калькуляторе: "uk:37:2", "koap:8.7:" */
  calc: string[]

  init(): Promise<void>
  setTab(tab: TabId): void
  loadLaw(id: LawId): Promise<void>
  openLaw(law: LawId, number: string): void
  openMemo(law: LawId, number: string): void
  setMemoQuery(q: string): void
  setMemoFilter(f: MemoFilter): void
  saveSettings(next: Settings): Promise<string[]>
  /** Мелкие правки (избранное, закладки, отметки) — сохраняются сразу */
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
  calc: [],

  async init() {
    const app = await api.getState()
    set({ app, memoFilter: app.settings.favorites.length ? 'fav' : 'all' })
    api.onState((patch) => {
      const prev = get().app
      if (!prev) return
      set({ app: { ...prev, ...patch } })
      if (patch.tab) get().setTab(patch.tab)
      // Законы обновились на форуме — перечитываем открытые
      if (patch.laws) {
        for (const meta of patch.laws) {
          const doc = get().docs[meta.id]
          if (doc && meta.fetchedAt && meta.fetchedAt !== doc.fetchedAt) void get().loadLaw(meta.id)
          if (!doc && meta.articles > 0) void get().loadLaw(meta.id)
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

  async saveSettings(next) {
    const errors = await api.saveSettings(next)
    return errors
  },

  patchSettings(fn) {
    const app = get().app
    if (!app) return
    const next = fn(app.settings)
    set({ app: { ...app, settings: next } })
    void api.saveSettings(next)
  },

  toggleCalc(key) {
    set((s) => ({ calc: s.calc.includes(key) ? s.calc.filter((k) => k !== key) : [...s.calc, key] }))
  },
  clearCalc: () => set({ calc: [] })
}))

/** Настройки уже загружены, когда рисуются вкладки */
export function useSettings(): Settings {
  return useStore((s) => s.app!.settings)
}
