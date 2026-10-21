// Демо-режим: интерфейс открыт в обычном браузере, без Electron (npm run ui).
// Законы берутся с dev-сервера (/dev-laws), если он их отдаёт.
// Параметры адреса: ?onboarding — мастер первого запуска, ?panel=interactive|layout — режим панели,
// ?scale=60 — масштаб панели.
import type { AppApi, AppState, PanelMode, Toast } from '../../../shared/api'
import { LAW_SOURCES, type LawDoc, type LawId } from '../../../shared/laws'
import { defaultSettings } from '../../../shared/settings'

const DEMO_TOASTS: Toast[] = [
  { id: 'd1', kind: 'run', title: 'Показать жетон', text: 'Строка 1 из 1', progress: 1, hint: 'стоп End', ttl: 0 },
  { id: 'd2', kind: 'warn', title: 'Отыгровка не отправлена', text: 'Активное окно — Discord.exe, а не GTA.', ttl: 0 }
]

export function createMockApi(): AppApi {
  const params = new URLSearchParams(location.search)
  const listeners = new Set<(patch: Partial<AppState>) => void>()
  const docs = new Map<LawId, LawDoc>()
  const settings = defaultSettings()
  settings.onboarded = !params.has('onboarding')
  settings.profiles[0] = { ...settings.profiles[0], name: 'Иван', surname: 'Петров', rank: 'Старший прапорщик полиции', unit: 'СОБР', badge: '0417', callsign: 'Гром-7' }
  // Пример из вопроса: ст. 89 — срок, ст. 91 — штраф вместо срока
  settings.calc = ['uk:89:', 'uk:91:', 'koap:8.7:']
  settings.calcAlt = ['uk:91:']
  if (params.has('scale')) settings.overlay.scale = Number(params.get('scale'))

  const state: AppState = {
    settings,
    game: { active: true, foregroundExe: 'GTA5.exe', fullscreen: false, fullscreenSeen: false },
    mode: 'active',
    panel: (params.get('panel') as PanelMode) ?? 'passive',
    tab: null,
    laws: LAW_SOURCES.map((s) => ({ id: s.id, title: s.title, articles: 0 })),
    lawsLoading: false,
    runningBind: null,
    update: { state: 'unsupported' },
    version: 'demo',
    elevated: true,
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
    saveSettings: async (next) => {
      emit({ settings: next })
      return []
    },
    patchSettings: (patch) => emit({ settings: { ...state.settings, ...patch } }),
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
    windowAction: () => {},
    setTab: () => {},
    panelAction: (panel) => emit({ panel }),
    setPanelMouse: () => {},
    exportPack: async () => false,
    importPack: async () => null,
    openExternal: (url) => window.open(url, '_blank'),
    copyText: (text) => void navigator.clipboard?.writeText(text),
    checkUpdates: () => {},
    installUpdate: () => {},
    restartAsAdmin: () => {},
    onToast: (cb) => {
      const timer = setTimeout(() => DEMO_TOASTS.forEach(cb), 300)
      return () => clearTimeout(timer)
    }
  }
}
