import type { AppApi, OverlayApi } from '../../shared/api'

declare global {
  interface Window {
    /** Есть только внутри Electron; в обычном браузере интерфейс работает на демо-данных */
    api?: AppApi
    overlay?: OverlayApi
  }
}
