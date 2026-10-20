// Журнал для разбора проблем: %APPDATA%\fsvng-helper\logs\main.log (до 512 КБ, плюс прошлый)
import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_SIZE = 512 * 1024

export const logsDir = () => join(app.getPath('userData'), 'logs')

export function log(message: string): void {
  console.log(`[fsvng-helper] ${message}`)
  try {
    mkdirSync(logsDir(), { recursive: true })
    const file = join(logsDir(), 'main.log')
    if (existsSync(file) && statSync(file).size > MAX_SIZE) renameSync(file, `${file}.1`)
    appendFileSync(file, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // Журнал не важнее работы приложения
  }
}
