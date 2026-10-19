// «Пак» — один файл с отыгровками и чек-листами, чтобы раздать отделу
import { dialog, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import type { PackImportResult } from '../shared/api'
import { uid, type Bind, type Checklist, type Settings } from '../shared/settings'
import { hotkeyId, parseHotkey } from './hotkeys'

interface Pack {
  type: 'fsvng-helper-pack'
  version: 1
  binds: Bind[]
  checklists: Checklist[]
}

export async function exportPack(win: BrowserWindow, settings: Settings): Promise<boolean> {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Сохранить пак отыгровок',
    defaultPath: 'Пак отыгровок УФСВНГ.json',
    filters: [{ name: 'Пак ФСВНГ Helper', extensions: ['json'] }]
  })
  if (canceled || !filePath) return false
  const pack: Pack = { type: 'fsvng-helper-pack', version: 1, binds: settings.binds, checklists: settings.checklists }
  writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf8')
  return true
}

function hotkeyKey(text: string | null): string | null {
  if (!text) return null
  try {
    return hotkeyId(parseHotkey(text))
  } catch {
    return null
  }
}

/**
 * Добавляет отыгровки и чек-листы из пака к своим. Клавиши, которые уже заняты,
 * у новых отыгровок снимаются — назначить их можно в редакторе.
 */
export async function importPack(win: BrowserWindow, settings: Settings): Promise<{ result: PackImportResult; settings: Settings } | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Открыть пак отыгровок',
    filters: [{ name: 'Пак ФСВНГ Helper', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null

  const pack = JSON.parse(readFileSync(filePaths[0], 'utf8').replace(/^﻿/, '')) as Partial<Pack>
  if (pack.type !== 'fsvng-helper-pack' || !Array.isArray(pack.binds)) {
    throw new Error('Это не пак отыгровок ФСВНГ Helper')
  }

  const taken = new Set(
    [...settings.binds.map((b) => b.hotkey), ...Object.values(settings.hotkeys)].map(hotkeyKey).filter(Boolean)
  )
  const binds: Bind[] = pack.binds
    .filter((b) => b && typeof b.name === 'string' && Array.isArray(b.lines))
    .map((b) => {
      const key = hotkeyKey(b.hotkey)
      const hotkey = key && !taken.has(key) ? b.hotkey : null
      if (key && hotkey) taken.add(key)
      return {
        id: uid(),
        name: b.name,
        hotkey,
        enterAfterEach: b.enterAfterEach !== false,
        lines: b.lines
          .filter((l) => l && typeof l.text === 'string')
          .map((l) => ({ text: l.text, delayMs: typeof l.delayMs === 'number' ? l.delayMs : null }))
      }
    })
  const checklists: Checklist[] = (pack.checklists ?? [])
    .filter((c) => c && typeof c.title === 'string' && Array.isArray(c.steps))
    .map((c) => ({ id: uid(), title: c.title, source: c.source, steps: c.steps.filter((s) => typeof s === 'string') }))

  return {
    result: { binds: binds.length, checklists: checklists.length },
    settings: { ...settings, binds: [...settings.binds, ...binds], checklists: [...settings.checklists, ...checklists] }
  }
}
