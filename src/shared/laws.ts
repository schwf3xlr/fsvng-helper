// Законы с форума RMRP: источники и разобранная структура

export type LawId = 'uk' | 'koap' | 'pk' | 'fz18'

export interface LawSource {
  id: LawId
  /** Коротко для чипов и бейджей */
  short: string
  title: string
  url: string
}

export const LAW_SOURCES: LawSource[] = [
  {
    id: 'uk',
    short: 'УК',
    title: 'Уголовный кодекс',
    url: 'https://forum.rmrp.ru/threads/ugolovnyj-kodeks-rossijskoj-federacii.58209/'
  },
  {
    id: 'koap',
    short: 'КоАП',
    title: 'Кодекс об административных правонарушениях',
    url: 'https://forum.rmrp.ru/threads/kodeks-ob-administrativnyx-pravonarushenijax-rossijskoj-federacii.58229/'
  },
  {
    id: 'pk',
    short: 'ПК',
    title: 'Процессуальный кодекс',
    url: 'https://forum.rmrp.ru/threads/processualnyj-kodeks-rossijskoj-federacii.58424/'
  },
  {
    id: 'fz18',
    short: 'ФЗ о ФСВНГ',
    title: 'ФЗ «О Федеральной службе войск национальной гвардии» № 18-ФЗ',
    url: 'https://forum.rmrp.ru/threads/federalnyj-zakon-o-federalnoj-sluzhbe-vojsk-nacionalnoj-gvardii-no-18-fz.25071/'
  }
]

export interface LawArticle {
  /** Номер как в законе: "5.1", "318", "27-29" */
  number: string
  title: string
  /** Раздел и глава, в которых стоит статья */
  section?: string
  chapter?: string
  /** Абзацы; внутри абзаца переносы строк сохранены (списки 1), 2)…) */
  paragraphs: string[]
  repealed: boolean
}

export interface LawChange {
  date: string
  text: string
}

export interface LawDoc {
  id: LawId
  title: string
  url: string
  /** Когда скачано (ISO) */
  fetchedAt: string
  /** «Последнее редактирование» первого поста, если форум его показывает */
  editedAt?: string
  articles: LawArticle[]
  /** Посты с поправками после основного текста */
  changes: LawChange[]
}

export interface LawsState {
  docs: Partial<Record<LawId, LawDoc>>
  /** Ошибки последней загрузки по закону */
  errors: Partial<Record<LawId, string>>
  loading: boolean
}
