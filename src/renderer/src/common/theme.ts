import { onAccent } from '../../../shared/settings'

function mixWithWhite(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * t))
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Акцентный цвет из настроек → CSS-переменные обоих окон */
export function applyAccent(accent: string): void {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return
  const root = document.documentElement.style
  const dark = onAccent(accent) === '#ffffff'
  root.setProperty('--accent', accent)
  root.setProperty('--accent-soft', `${accent}2b`)
  root.setProperty('--accent-line', `${accent}8c`)
  root.setProperty('--on-accent', onAccent(accent))
  // Тёмный крап на тёмном фоне не читается как текст — для текста и значков светлее
  root.setProperty('--accent-text', dark ? mixWithWhite(accent, 0.38) : accent)
}
