// Права администратора. Без них Windows не даёт перехватывать клавиши и ставить окна
// поверх игры, если сама игра запущена от администратора.
//
// Схема: приложение без прав перезапускает себя с правами. Первый раз Windows
// спрашивает (UAC), дальше — без вопросов, через задачу планировщика с высшими правами.
// Задачу создаём, только если файлы программы может менять лишь администратор
// (Program Files или папка, защищённая установщиком): иначе любой процесс мог бы
// подменить exe и получить права без вопроса Windows.
import { app } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { isElevated } from './win32'

const TASK_PREFIX = 'FSVNG Helper'
/** Задачи 0.3–0.5.1: имя без привязки к папке программы */
const LEGACY_TASK_RUN = 'FSVNG Helper'

function run(cmd: string, args: string[]): number {
  return spawnSync(cmd, args, { windowsHide: true, timeout: 30_000 }).status ?? -1
}

function runAsync(cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, env: env ?? process.env })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    const timer = setTimeout(() => child.kill(), 60_000)
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ code: -1, out })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, out })
    })
  })
}

function installedPerMachine(): boolean {
  const exe = process.execPath.toLowerCase()
  return [process.env.ProgramFiles, process.env.ProgramW6432]
    .filter((p): p is string => !!p)
    .some((p) => exe.startsWith(`${p.toLowerCase()}\\`))
}

/** Имя задачи привязано к пути программы: переустановка в другую папку — другая задача */
function taskNames(): { run: string; autostart: string } {
  const h = createHash('sha1').update(process.execPath.toLowerCase()).digest('hex').slice(0, 8)
  return { run: `${TASK_PREFIX} ${h}`, autostart: `${TASK_PREFIX} ${h} (autostart)` }
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

  // Задача планировщика запускает с правами без окна UAC. Задача прошлых версий
  // подходит, только если программа по-прежнему в Program Files
  const names = taskNames()
  const task = taskExists(names.run)
    ? names.run
    : installedPerMachine() && taskExists(LEGACY_TASK_RUN)
      ? LEGACY_TASK_RUN
      : null
  if (task && run('schtasks', ['/Run', '/TN', task]) === 0) return true

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

async function registerTask(name: string, logon: boolean): Promise<void> {
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
    await runAsync('schtasks', ['/Create', '/TN', name, '/XML', file, '/F'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const deleteTask = (name: string) => runAsync('schtasks', ['/Delete', '/TN', name, '/F'])

/** Все наши задачи в планировщике (имена только латиницей — кодировка вывода не мешает) */
async function listOurTasks(): Promise<string[]> {
  const { out } = await runAsync('schtasks', ['/Query', '/FO', 'CSV', '/NH'])
  const names = new Set<string>()
  for (const m of out.matchAll(/^"\\(FSVNG Helper[^"\\]*)"/gm)) names.add(m[1])
  return [...names]
}

/**
 * Можно ли менять файлы программы без прав администратора. Проверяем папку программы
 * со всем содержимым (запись, удаление, смена прав и владельца) и все папки выше
 * (их нельзя переименовать или удалить, чтобы подсунуть свою папку с тем же путём).
 * Владельцем везде должен быть администратор, SYSTEM или TrustedInstaller.
 */
const TRUST_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
  $dir = [IO.Path]::GetFullPath($env:FSVNG_CHECK_DIR)
  $sid = [Security.Principal.SecurityIdentifier]
  $me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  # Все, прошедшие проверку, пользователи, интерактивные, гости, сеть, владелец-создатель и сам пользователь
  $weak = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545', 'S-1-5-4', 'S-1-5-32-546', 'S-1-5-2', 'S-1-3-0', $me)
  $strong = @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
  # Запись, добавление, удаление вложенного, атрибуты, удаление, смена прав и владельца, GENERIC_ALL и GENERIC_WRITE
  $writeMask = [int64](0x2 -bor 0x4 -bor 0x10 -bor 0x40 -bor 0x100 -bor 0x10000 -bor 0x40000 -bor 0x80000 -bor 0x10000000 -bor 0x40000000)
  # Для папок выше важно только то, что позволяет переименовать или удалить путь
  $parentMask = [int64](0x40 -bor 0x10000 -bor 0x40000 -bor 0x80000 -bor 0x10000000)
  function Weakness($path, $mask) {
    $acl = Get-Acl -LiteralPath $path
    $owner = $acl.GetOwner($sid).Value
    if ($strong -notcontains $owner) { return "владелец $owner у $path" }
    foreach ($r in $acl.GetAccessRules($true, $true, $sid)) {
      if ($r.AccessControlType -ne 'Allow') { continue }
      if (([int]$r.PropagationFlags -band 2) -ne 0) { continue }
      $v = [int64]$r.FileSystemRights.value__
      if ($v -lt 0) { $v += 4294967296 }
      if (($v -band $mask) -eq 0) { continue }
      if ($weak -contains $r.IdentityReference.Value) { return "права $($r.IdentityReference.Value) на $path" }
    }
    return $null
  }
  $items = @((Get-Item -LiteralPath $dir).FullName) + @(Get-ChildItem -LiteralPath $dir -Recurse -Force | ForEach-Object { $_.FullName })
  foreach ($p in $items) { $w = Weakness $p $writeMask; if ($w) { Write-Output $w; exit } }
  $parent = [IO.Path]::GetDirectoryName($dir)
  while ($parent) {
    $next = [IO.Path]::GetDirectoryName($parent)
    # Корень диска нельзя переименовать или удалить — у него важно только «удаление вложенного»
    $mask = if (-not $next) { $parentMask -band (-bnot [int64]0x10000) } else { $parentMask }
    $w = Weakness $parent $mask
    if ($w) { Write-Output $w; exit }
    if (-not $next -or $next -eq $parent) { break }
    $parent = $next
  }
  Write-Output 'OK'
} catch { Write-Output "ошибка проверки: $($_.Exception.Message)" }
`

async function checkInstallDir(): Promise<{ ok: boolean; reason: string }> {
  if (installedPerMachine()) return { ok: true, reason: 'Program Files' }
  const encoded = Buffer.from(TRUST_SCRIPT, 'utf16le').toString('base64')
  const { out } = await runAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-EncodedCommand', encoded],
    { ...process.env, FSVNG_CHECK_DIR: dirname(process.execPath) }
  )
  const answer = out.trim().split(/\r?\n/).pop() ?? ''
  return { ok: answer === 'OK', reason: answer || 'проверка не ответила' }
}

/**
 * Задачи планировщика: запуск с правами без UAC и автозапуск при входе в Windows.
 * Работает только в установленной версии с правами администратора.
 * Возвращает null, если всё в порядке, иначе — почему Windows будет спрашивать права.
 */
export async function syncTasks(autostart: boolean, log: (message: string) => void): Promise<string | null> {
  if (!app.isPackaged) return null
  if (!isElevated()) {
    // Без задачи — обычный автозапуск; права попросит сам перезапуск при старте
    app.setLoginItemSettings({ openAtLogin: autostart, args: ['--hidden'] })
    return null
  }

  const names = taskNames()
  // Задачи прошлых версий и других папок установки больше не нужны
  for (const t of await listOurTasks()) {
    if (t !== names.run && t !== names.autostart) await deleteTask(t)
  }

  const trust = await checkInstallDir()
  if (!trust.ok) {
    log(`запуск с правами без вопроса Windows недоступен: ${trust.reason}`)
    for (const t of [names.run, names.autostart]) if (taskExists(t)) await deleteTask(t)
    app.setLoginItemSettings({ openAtLogin: autostart, args: ['--hidden'] })
    return trust.reason
  }

  // Автозапуск через реестр не умеет запускать с правами — его заменяет задача
  app.setLoginItemSettings({ openAtLogin: false })
  await registerTask(names.run, false)
  if (autostart) await registerTask(names.autostart, true)
  else if (taskExists(names.autostart)) await deleteTask(names.autostart)
  return null
}
