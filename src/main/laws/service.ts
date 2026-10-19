// Законы: скачиваем темы с форума RMRP, разбираем и храним копию на диске,
// чтобы они открывались без интернета и сразу при запуске.
import { app, net } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LawMeta } from '../../shared/api'
import { LAW_SOURCES, type LawDoc, type LawId } from '../../shared/laws'
import { parseLawThread } from './parse'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

/** Как часто проверять форум на изменения */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000

async function fetchPage(url: string): Promise<string> {
  const res = await net.fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru-RU,ru;q=0.9' },
    signal: AbortSignal.timeout(30_000)
  })
  if (!res.ok) throw new Error(`форум ответил ${res.status}`)
  return res.text()
}

export class LawsService {
  private docs = new Map<LawId, LawDoc>()
  private errors = new Map<LawId, string>()
  loading = false

  constructor(private readonly onChange: () => void) {}

  private dir(): string {
    return join(app.getPath('userData'), 'laws')
  }

  loadCache(): void {
    for (const src of LAW_SOURCES) {
      const file = join(this.dir(), `${src.id}.json`)
      if (!existsSync(file)) continue
      try {
        this.docs.set(src.id, JSON.parse(readFileSync(file, 'utf8')) as LawDoc)
      } catch {
        // Битый кэш — скачаем заново
      }
    }
  }

  get(id: LawId): LawDoc | null {
    return this.docs.get(id) ?? null
  }

  meta(): LawMeta[] {
    return LAW_SOURCES.map((src) => {
      const doc = this.docs.get(src.id)
      return {
        id: src.id,
        title: src.title,
        fetchedAt: doc?.fetchedAt,
        editedAt: doc?.editedAt,
        articles: doc?.articles.length ?? 0,
        error: this.errors.get(src.id)
      }
    })
  }

  /** Пора ли обновить: чего-то нет в кэше или копия старше 12 часов */
  isStale(): boolean {
    return LAW_SOURCES.some((src) => {
      const doc = this.docs.get(src.id)
      return !doc || Date.now() - Date.parse(doc.fetchedAt) > REFRESH_AFTER_MS
    })
  }

  async refresh(): Promise<void> {
    if (this.loading) return
    this.loading = true
    this.onChange()
    mkdirSync(this.dir(), { recursive: true })

    await Promise.all(
      LAW_SOURCES.map(async (src) => {
        try {
          const doc = parseLawThread(await fetchPage(src.url), src.id, src.url)
          this.docs.set(src.id, doc)
          this.errors.delete(src.id)
          writeFileSync(join(this.dir(), `${src.id}.json`), JSON.stringify(doc), 'utf8')
        } catch (e) {
          this.errors.set(src.id, (e as Error).message)
        }
      })
    )

    this.loading = false
    this.onChange()
  }
}
