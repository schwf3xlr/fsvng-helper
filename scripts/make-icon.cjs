// Рисует иконку приложения в resources/icon.png: краповый щит с золотой
// окантовкой, звездой и лавровыми ветвями — в цветах Росгвардии.
// Запуск: npm run icon
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 512
const CX = 256

/** Пятиконечная звезда */
function star(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.4
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

/** Лавровая ветвь: стебель-дуга и листья в шахматном порядке; side = -1 слева, 1 справа */
function laurel(side) {
  const p0 = [CX + side * 16, 404]
  const p1 = [CX + side * 132, 392]
  const p2 = [CX + side * 118, 232]
  const at = (t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
  ]
  const tangent = (t) => [
    2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
    2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  ]
  const parts = [
    `<path d="M${p0.join(' ')} Q${p1.join(' ')} ${p2.join(' ')}" fill="none" stroke="url(#gold)" stroke-width="7" stroke-linecap="round"/>`
  ]
  const n = 7
  for (let i = 0; i < n; i++) {
    const t = 0.1 + (i / (n - 1)) * 0.86
    const [x, y] = at(t)
    const [dx, dy] = tangent(t)
    const len = Math.hypot(dx, dy)
    const along = Math.atan2(dy, dx)
    // Листья по очереди наружу и внутрь дуги, под углом к стеблю
    const out = i % 2 === 0 ? 1 : -1
    const nx = (-dy / len) * side * out
    const ny = (dx / len) * side * out
    const dir = along + side * out * 0.6
    const cx = x + nx * 14
    const cy = y + ny * 14
    const deg = (dir * 180) / Math.PI + 90
    parts.push(
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="8" ry="20" transform="rotate(${deg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="url(#gold)"/>`
    )
  }
  // Верхний лист на конце ветви
  const [ex, ey] = p2
  const [tx, ty] = tangent(1)
  parts.push(
    `<ellipse cx="${(ex + (tx / Math.hypot(tx, ty)) * 14).toFixed(1)}" cy="${(ey + (ty / Math.hypot(tx, ty)) * 14).toFixed(1)}" rx="8" ry="19" transform="rotate(${((Math.atan2(ty, tx) * 180) / Math.PI + 90).toFixed(1)} ${(ex + (tx / Math.hypot(tx, ty)) * 14).toFixed(1)} ${(ey + (ty / Math.hypot(tx, ty)) * 14).toFixed(1)})" fill="url(#gold)"/>`
  )
  return parts.join('')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211A1C"/><stop offset="1" stop-color="#100C0D"/></linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C02A42"/><stop offset="1" stop-color="#6A1020"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4DA92"/><stop offset="1" stop-color="#C29236"/></linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="none" stroke="#3B2D31" stroke-width="6"/>
  <path d="M256 56 L414 112 L414 238 C414 344 348 420 256 460 C164 420 98 344 98 238 L98 112 Z"
        fill="url(#shield)" stroke="url(#gold)" stroke-width="16" stroke-linejoin="round"/>
  ${laurel(-1)}
  ${laurel(1)}
  <polygon points="${star(CX, 214, 92)}" fill="url(#gold)"/>
</svg>`

const html = `<!doctype html><html style="overflow:hidden"><body style="margin:0;overflow:hidden;background:transparent">${svg.replace('<svg ', '<svg style="display:block" ')}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((r) => setTimeout(r, 400))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  const out = join(__dirname, '..', 'resources')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'icon.png'), image.resize({ width: SIZE, height: SIZE }).toPNG())
  // Превью мелких размеров — проверить, что значок читается в трее
  if (process.env.ICON_PREVIEW) {
    for (const s of [16, 32, 64]) writeFileSync(join(process.env.ICON_PREVIEW, `icon-${s}.png`), image.resize({ width: s, height: s, quality: 'best' }).toPNG())
  }
  console.log('icon.png готов:', image.getSize())
  app.quit()
})
