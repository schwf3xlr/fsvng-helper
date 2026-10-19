// Демо-режим: интерфейс открыт в обычном браузере, без Electron.
// Законы берутся с dev-сервера (/dev-laws), если он их отдаёт.
import type { AppApi, AppState } from '../../../shared/api'
import { LAW_SOURCES, type LawDoc, type LawId } from '../../../shared/laws'
import { defaultSettings } from '../../../shared/settings'

export function createMockApi(): AppApi {
  const listeners = new Set<(patch: Partial<AppState>) => void>()
  const docs = new Map<LawId, LawDoc>()
  const state: AppState = {
    settings: defaultSettings(),
    game: { active: true, foregroundExe: 'GTA5.exe', fullscreen: false, fullscreenSeen: false },
    mode: 'active',
    tab: null,
    laws: LAW_SOURCES.map((s) => ({ id: s.id, title: s.title, articles: 0 })),
    lawsLoading: false,
    runningBind: null,
    update: { state: 'unsupported' },
    version: 'demo',
    settingsErrors: []
  }
  const emit = (patch: Partial<AppState>) => {
    Object.assign(state, patch)
    listeners.forEach((l) => l(patch))
  }

  const loadDocs = async () => {
    await Promise.all(
      LAW_SOURCES.map(async (s) => {
        try {
          const res = await fetch(`/dev-laws/${s.id}.json`)
          if (res.ok) docs.set(s.id, (await res.json()) as LawDoc)
        } catch {
          // нет демо-законов
        }
      })
    )
    emit({
      laws: LAW_SOURCES.map((s) => {
        const d = docs.get(s.id)
        return { id: s.id, title: s.title, articles: d?.articles.length ?? 0, fetchedAt: d?.fetchedAt, editedAt: d?.editedAt }
      })
    })
  }
  const ready = loadDocs()

  return {
    getState: async () => structuredClone(state),
    onState: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    saveSettings: async (settings) => {
      emit({ settings })
      return []
    },
    getLaw: async (id) => {
      await ready
      return docs.get(id) ?? null
    },
    refreshLaws: async () => {
      emit({ lawsLoading: true })
      await loadDocs()
      emit({ lawsLoading: false })
    },
    runBind: (id) => {
      emit({ runningBind: id })
      setTimeout(() => emit({ runningBind: null }), 1500)
    },
    stopBind: () => emit({ runningBind: null }),
    setHotkeyCapture: () => {},
    windowAction: (action) => {
      if (action === 'glass') emit({ mode: 'glass' })
      if (action === 'active') emit({ mode: 'active' })
    },
    setTab: () => {},
    exportPack: async () => false,
    importPack: async () => null,
    openExternal: (url) => window.open(url, '_blank'),
    copyText: (text) => void navigator.clipboard?.writeText(text),
    checkUpdates: () => {},
    installUpdate: () => {}
  }
}
