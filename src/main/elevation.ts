// Права администратора. Без них Windows не даёт перехватывать клавиши и ставить окна
// поверх игры, если сама игра запущена от администратора.
//
// Схема: приложение без прав перезапускает себя с правами. Первый раз Windows
// спрашивает (UAC), дальше — без вопросов, через задачу планировщика с высшими правами.
// Задачу создаём, только если программа установлена в Program Files: туда пишут лишь
// администраторы, и подменить exe, на который смотрит задача, нельзя.
import { app } from 'electron'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isElevated } from './win32'

const TASK_RUN = 'FSVNG Helper'
const TASK_AUTOSTART = 'FSVNG Helper (autostart)'

function run(cmd: string, args: string[]): number {
  return spawnSync(cmd, args, { windowsHide: true, timeout: 30_000 }).status ?? -1
}

function installedPerMachine(): boolean {
  const exe = process.execPath.toLowerCase()
  return [process.env.ProgramFiles, process.env.ProgramW6432]
    .filter((p): p is string => !!p)
    .some((p) => exe.startsWith(`${p.toLowerCase()}\\`))
}

const taskExists = (name: string) => run('schtasks', ['/Query', '/TN', name]) === 0

/**
 * Вызывать в самом начале, до блокировки единственного экземпляра.
 * true — запущена копия с правами, этот процесс нужно закрыть.
 */
export function relaunchElevated(force = false): boolean {
  if (!app.isPackaged || isElevated()) return false
  // Уже перезапускались, а прав так и нет (отказ в UAC) — работаем как есть
  if (!force && process.argv.includes('--elevated')) return false

  // Задача планировщика запускает с правами без окна UAC
  if (installedPerMachine() && taskExists(TASK_RUN) && run('schtasks', ['/Run', '/TN', TASK_RUN]) === 0) return true

  const args = ['--elevated', ...(process.argv.includes('--hidden') ? ['--hidden'] : [])].join(' ')
  const exe = process.execPath.replace(/'/g, "''")
  return (
    run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process -FilePath '${exe}' -ArgumentList '${args}' -Verb RunAs`
    ]) === 0
  )
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function registerTask(name: string, logon: boolean): void {
  const user = xmlEscape(`${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME ?? ''}`)
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>ФСВНГ Helper: запуск с правами администратора без окна UAC</Description></RegistrationInfo>
  <Triggers>${logon ? `<LogonTrigger><Enabled>true</Enabled><UserId>${user}</UserId><Delay>PT10S</Delay></LogonTrigger>` : ''}</Triggers>
  <Principals><Principal id="Author"><UserId>${user}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author"><Exec><Command>${xmlEscape(process.execPath)}</Command>${logon ? '<Arguments>--hidden</Arguments>' : ''}</Exec></Actions>
</Task>`
  const dir = mkdtempSync(join(tmpdir(), 'fsvng-task-'))
  const file = join(dir, 'task.xml')
  try {
    writeFileSync(file, Buffer.from(`﻿${xml}`, 'utf16le'))
    run('schtasks', ['/Create', '/TN', name, '/XML', file, '/F'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Задачи планировщика: запуск с правами без UAC и автозапуск при входе в Windows.
 * Работает только в установленной версии с правами администратора.
 */
export function syncTasks(autostart: boolean): void {
  if (!app.isPackaged) return
  if (!installedPerMachine() || !isElevated()) {
    // Без задачи — обычный автозапуск; права попросит сам перезапуск при старте
    app.setLoginItemSettings({ openAtLogin: autostart, args: ['--hidden'] })
    return
  }
  // Автозапуск через реестр не умеет запускать с правами — его заменяет задача
  app.setLoginItemSettings({ openAtLogin: false })
  registerTask(TASK_RUN, false)
  if (autostart) registerTask(TASK_AUTOSTART, true)
  else if (taskExists(TASK_AUTOSTART)) run('schtasks', ['/Delete', '/TN', TASK_AUTOSTART, '/F'])
}
