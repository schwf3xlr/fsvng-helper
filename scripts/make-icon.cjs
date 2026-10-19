// Рисует иконку приложения (щит из макета) в resources/icon.png.
// Запуск: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 512
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <rect x="20" y="20" width="472" height="472" rx="110" fill="#16181C"/>
  <rect x="20" y="20" width="472" height="472" rx="110" fill="none" stroke="#3A3F48" stroke-width="8"/>
  <g transform="translate(64 58) scale(16)">
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" fill="#E0B04A"/>
    <circle cx="12" cy="11" r="2.7" fill="#16181C"/>
  </g>
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
  console.log('icon.png готов:', image.getSize())
  app.quit()
})
