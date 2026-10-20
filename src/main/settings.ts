// Хранение настроек: %APPDATA%\fsvng-helper\settings.json
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ACCENTS,
  BINDS_REV,
  DEFAULT_BINDS,
  DEFAULT_BINDS_V1,
  defaultSettings,
  SCALE_MAX,
  SCALE_MIN,
  type Bind,
  type Settings
} from '../shared/settings'

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

const clamp = (v: unknown, min: number, max: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def

const sameKey = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/**
 * Стандартные отыгровки 0.2–0.3 → набор BINDS_REV. Нетронутые старые убираются или
 * заменяются новыми, свои и изменённые остаются на месте.
 */
function migrateBinds(binds: Bind[], hotkeys: Settings['hotkeys']): Bind[] {
  const isOldDefault = (b: Bind) => DEFAULT_BINDS_V1[b.id] !== undefined && b.lines[0]?.text === DEFAULT_BINDS_V1[b.id]
  const kept = binds.filter((b) => !isOldDefault(b))
  const taken = [...Object.values(hotkeys), ...kept.map((b) => b.hotkey)]
  const free = (key: string | null) => (key && !taken.some((t) => sameKey(t, key)) ? key : null)

  const out: Bind[] = []
  for (const b of binds) {
    if (!isOldDefault(b)) {
      out.push(b)
      continue
    }
    const next = DEFAULT_BINDS.find((d) => d.id === b.id)
    if (!next) continue
    const hotkey = free(next.hotkey) ?? free(b.hotkey)
    taken.push(hotkey)
    out.push({ ...structuredClone(next), hotkey })
  }
  return out
}

/** Достраивает настройки из файла значениями по умолчанию (новые поля в новых версиях) */
export function normalizeSettings(raw: Partial<Settings>): Settings {
  const def = defaultSettings()
  // В 0.2.0 были клавиши «стекло» и «памятки» — панель заняла их место
  const oldKeys = (raw.hotkeys ?? {}) as Record<string, string | null | undefined>
  const hotkey = (key: keyof Settings['hotkeys'], legacy?: string) =>
    oldKeys[key] !== undefined ? (oldKeys[key] ?? null) : legacy && oldKeys[legacy] !== undefined ? (oldKeys[legacy] ?? null) : def.hotkeys[key]

  const s: Settings = {
    ...def,
    ...raw,
    version: 1,
    hotkeys: {
      window: hotkey('window'),
      panel: hotkey('panel', 'memos'),
      interact: hotkey('interact'),
      step: hotkey('step'),
      stepBack: hotkey('stepBack'),
      stop: hotkey('stop')
    },
    chat: { ...def.chat, ...raw.chat },
    ui: { ...def.ui, ...raw.ui },
    overlay: { ...def.overlay, ...raw.overlay },
    game: { ...def.game, ...raw.game },
    checks: { ...raw.checks }
  }
  // Пользователи 0.2.0 уже настроились — мастер им не нужен
  if (raw.onboarded === undefined && raw.version !== undefined) s.onboarded = true
  // Цвета 0.2.0 убраны из палитры — переходим на цвет Росгвардии
  if (!ACCENTS.some((a) => a.color.toLowerCase() === s.ui.accent?.toLowerCase())) s.ui.accent = def.ui.accent
  // Поля прошлых версий: «всегда поверх» (поверх игры теперь только панель) и «стекло»
  for (const old of ['alwaysOnTop', 'glassOpacity']) delete (s.ui as Partial<Record<string, unknown>>)[old]
  s.ui.scale = clamp(s.ui.scale, SCALE_MIN, SCALE_MAX, def.ui.scale)
  s.overlay.scale = clamp(s.overlay.scale, SCALE_MIN, SCALE_MAX, def.overlay.scale)
  if (!Array.isArray(s.profiles) || s.profiles.length === 0) s.profiles = def.profiles
  if (!s.profiles.some((p) => p.id === s.activeProfileId)) s.activeProfileId = s.profiles[0].id
  for (const key of ['binds', 'favorites', 'bookmarks', 'checklists', 'calc', 'calcAlt'] as const) {
    if (!Array.isArray(s[key])) (s as unknown as Record<string, unknown>)[key] = def[key]
  }
  s.calcAlt = s.calcAlt.filter((k) => s.calc.includes(k))

  // Новые клавиши шагов не должны отнять клавишу у своих отыгровок
  for (const key of ['step', 'stepBack'] as const) {
    if (oldKeys[key] !== undefined) continue
    const others = [...Object.entries(s.hotkeys).filter(([k]) => k !== key).map(([, v]) => v), ...s.binds.map((b) => b.hotkey)]
    if (others.some((o) => sameKey(o, s.hotkeys[key]))) s.hotkeys[key] = null
  }

  if (raw.binds && (raw.bindsRev ?? 1) < BINDS_REV) s.binds = migrateBinds(s.binds, s.hotkeys)
  s.bindsRev = BINDS_REV
  return s
}

export function loadSettings(): { settings: Settings; error?: string } {
  const path = settingsPath()
  if (!existsSync(path)) return { settings: defaultSettings() }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) as Partial<Settings>
    return { settings: normalizeSettings(raw) }
  } catch (e) {
    return { settings: defaultSettings(), error: `Настройки не прочитаны (${(e as Error).message}), загружены стандартные` }
  }
}

/** Пишем через временный файл, чтобы не испортить настройки при сбое */
export function writeSettings(settings: Settings): void {
  const path = settingsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(tmp, path)
}
