// Законы с форума RMRP: источники и разобранная структура

export type LawId = 'uk' | 'koap' | 'pk' | 'fz18' | 'fz34' | 'fz86' | 'fkz28'

export interface LawSource {
  id: LawId
  /** Для фильтров памяток */
  short: string
  /** Бейдж на карточке: «УК», «34-ФЗ» */
  badge: string
  title: string
  url: string
}

export const LAW_SOURCES: LawSource[] = [
  {
    id: 'uk',
    short: 'УК',
    badge: 'УК',
    title: 'Уголовный кодекс',
    url: 'https://forum.rmrp.ru/threads/ugolovnyj-kodeks-rossijskoj-federacii.58209/'
  },
  {
    id: 'koap',
    short: 'КоАП',
    badge: 'КоАП',
    title: 'Кодекс об административных правонарушениях',
    url: 'https://forum.rmrp.ru/threads/kodeks-ob-administrativnyx-pravonarushenijax-rossijskoj-federacii.58229/'
  },
  {
    id: 'pk',
    short: 'ПК',
    badge: 'ПК',
    title: 'Процессуальный кодекс',
    url: 'https://forum.rmrp.ru/threads/processualnyj-kodeks-rossijskoj-federacii.58424/'
  },
  {
    id: 'fz18',
    short: 'О ФСВНГ',
    badge: '18-ФЗ',
    title: 'ФЗ «О Федеральной службе войск национальной гвардии» № 18-ФЗ',
    url: 'https://forum.rmrp.ru/threads/federalnyj-zakon-o-federalnoj-sluzhbe-vojsk-nacionalnoj-gvardii-no-18-fz.25071/'
  },
  {
    id: 'fz34',
    short: 'Об оружии',
    badge: '34-ФЗ',
    title: 'ФЗ «Об оружии» № 34-ФЗ',
    url: 'https://forum.rmrp.ru/threads/federalnyj-zakon-ob-oruzhii-no-34-fz.25068/'
  },
  {
    id: 'fz86',
    short: 'Территории',
    badge: '86-ФЗ',
    title: 'ФЗ «О государственной собственности, закрытых и охраняемых территориях» № 86-ФЗ',
    url: 'https://forum.rmrp.ru/threads/federalnyj-zakon-o-gosudarstvennoj-sobstvennosti-zakrytyx-i-oxranjaemyx-territorijax-no-86-fz.26625/'
  },
  {
    id: 'fkz28',
    short: 'Особые режимы',
    badge: '28-ФКЗ',
    title: 'ФКЗ «Об особых правовых режимах» № 28-ФКЗ',
    url: 'https://forum.rmrp.ru/threads/federalnyj-konstitucionnyj-zakon-ob-osobyx-pravovyx-rezhimax-no-28-fkz.25066/'
  }
]

export function lawSource(id: LawId): LawSource {
  return LAW_SOURCES.find((s) => s.id === id) ?? LAW_SOURCES[0]
}

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
