// `npm run ui` — интерфейс в обычном браузере на демо-данных, без Electron.
// Законы для демо: папка с uk.json, koap.json… в переменной FSVNG_DEV_LAWS.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function devLaws(): Plugin {
  return {
    name: 'fsvng-dev-laws',
    configureServer(server) {
      const dir = process.env.FSVNG_DEV_LAWS
      if (!dir) return
      server.middlewares.use('/dev-laws', (req, res, next) => {
        const file = join(dir, (req.url ?? '').replace(/^\//, '').replace(/[^\w.-]/g, ''))
        if (!existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(readFileSync(file))
      })
    }
  }
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react(), devLaws()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true }
})
