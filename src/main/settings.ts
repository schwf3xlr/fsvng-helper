// Хранение настроек: %APPDATA%\fsvng-helper\settings.json
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ACCENTS, defaultSettings, type Settings } from '../shared/settings'

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
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
  if (!Array.isArray(s.profiles) || s.profiles.length === 0) s.profiles = def.profiles
  if (!s.profiles.some((p) => p.id === s.activeProfileId)) s.activeProfileId = s.profiles[0].id
  for (const key of ['binds', 'favorites', 'bookmarks', 'checklists', 'calc'] as const) {
    if (!Array.isArray(s[key])) (s as unknown as Record<string, unknown>)[key] = def[key]
  }
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
