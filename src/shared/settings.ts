// Настройки приложения и данные по умолчанию (УФСВНГ по Арбатскому ФО)

export type Gender = 'm' | 'f'

export interface Profile {
  id: string
  name: string
  surname: string
  rank: string
  unit: string
  badge: string
  callsign: string
  gender: Gender
}

export interface BindLine {
  text: string
  /** Пауза после строки, мс; null — общая из настроек */
  delayMs: number | null
}

export interface Bind {
  id: string
  name: string
  hotkey: string | null
  lines: BindLine[]
  /** Нажимать Enter после каждой строки (иначе текст остаётся в поле чата) */
  enterAfterEach: boolean
}

export interface Checklist {
  id: string
  title: string
  /** Откуда взято: «ст. 10 ПК» */
  source?: string
  steps: string[]
}

export type HotkeyAction = 'window' | 'panel' | 'interact' | 'stop'

export const HOTKEY_ACTIONS: { id: HotkeyAction; label: string; hint?: string }[] = [
  { id: 'window', label: 'Окно приложения', hint: 'открыть поверх игры или спрятать' },
  { id: 'panel', label: 'Панель в игре', hint: 'показать или спрятать, клики идут в игру' },
  { id: 'interact', label: 'Управлять панелью', hint: 'поиск, галочки, мышь; Esc — назад в игру' },
  { id: 'stop', label: 'Остановить отыгровку' }
]

export type PanelTab = 'memos' | 'search' | 'checklist' | 'binds'

export type InputMethod = 'keys' | 'paste'

export interface Settings {
  version: 1
  profiles: Profile[]
  activeProfileId: string
  binds: Bind[]
  hotkeys: Record<HotkeyAction, string | null>
  chat: {
    openKey: string
    method: InputMethod
    openDelayMs: number
    lineDelayMs: number
    closeWithEnter: boolean
  }
  ui: {
    accent: string
    scale: number
    alwaysOnTop: boolean
    autostart: boolean
    lawFontSize: number
  }
  /** Панель поверх игры */
  overlay: {
    /** Положение левого верхнего угла в процентах экрана; null — справа по умолчанию */
    x: number | null
    y: number | null
    width: number
    /** Наибольшая высота, % высоты экрана */
    maxHeight: number
    opacity: number
    scale: number
    tab: PanelTab
    checklistId: string | null
  }
  game: {
    processNames: string[]
    classNames: string[]
  }
  /** Бинды и хоткеи работают в любом окне — для проверки без игры */
  testMode: boolean
  /** Мастер первого запуска пройден */
  onboarded: boolean
  /** Избранные памятки: "uk:44", "koap:8.7", "pk:10" */
  favorites: string[]
  /** Закладки в тексте законов: "uk:44" */
  bookmarks: string[]
  checklists: Checklist[]
  /** Отметки в чек-листах: id → номера отмеченных шагов */
  checks: Record<string, number[]>
  /** Статьи в калькуляторе: "uk:37:2", "koap:8.7:" — общие для окна, панели и {статьи} */
  calc: string[]
}

/** Крап — цвет беретов и знамён Росгвардии */
export const ACCENTS = [
  { color: '#B3243B', label: 'Крап' },
  { color: '#D63B3B', label: 'Алый' },
  { color: '#D4AF5A', label: 'Золото' },
  { color: '#7E9CB8', label: 'Сталь' }
]

/** Цвет текста на кнопке с акцентным фоном: тёмный на светлом, белый на тёмном */
export function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#16120f' : '#ffffff'
}

export const RANKS = [
  'Рядовой полиции',
  'Младший сержант полиции',
  'Сержант полиции',
  'Старший сержант полиции',
  'Старшина полиции',
  'Прапорщик полиции',
  'Старший прапорщик полиции',
  'Младший лейтенант полиции',
  'Лейтенант полиции',
  'Старший лейтенант полиции',
  'Капитан полиции',
  'Майор полиции',
  'Подполковник полиции',
  'Полковник полиции',
  'Генерал-майор полиции',
  'Генерал-лейтенант полиции',
  'Генерал-полковник полиции',
  'Генерал полиции Российской Федерации'
]

export const UNITS = ['ОМОН', 'СОБР', 'УСБ', 'ЦПП', 'АВНГ', 'ВБП', 'Руководство']

/** Переменные для строк отыгровок */
export const VARIABLES: { token: string; label: string }[] = [
  { token: '{имя}', label: 'Имя' },
  { token: '{фамилия}', label: 'Фамилия' },
  { token: '{звание}', label: 'Звание' },
  { token: '{подразделение}', label: 'Подразделение' },
  { token: '{жетон}', label: 'Номер жетона' },
  { token: '{позывной}', label: 'Позывной' },
  { token: '{время}', label: 'Время ЧЧ:ММ' },
  { token: '{дата}', label: 'Дата' },
  { token: '{статьи}', label: 'Статьи из калькулятора' }
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const CALC_LAW_NAMES: Record<string, string> = { uk: 'УК РФ', koap: 'КоАП РФ' }

/** Ключи калькулятора → «УК РФ ст. 44, ст. 46 ч. 2; КоАП РФ ст. 8.7» */
export function formatCalcArticles(keys: string[]): string {
  const byLaw = new Map<string, string[]>()
  for (const key of keys) {
    const [law, number, part] = key.split(':')
    const list = byLaw.get(law) ?? []
    list.push(`ст. ${number}${part ? ` ч. ${part}` : ''}`)
    byLaw.set(law, list)
  }
  return [...byLaw.entries()].map(([law, list]) => `${CALC_LAW_NAMES[law] ?? law} ${list.join(', ')}`).join('; ')
}

/** Отыгровка использует статьи из калькулятора */
export function usesArticles(text: string): boolean {
  return /\{статьи\}/i.test(text)
}

/**
 * Подставляет профиль в строку отыгровки.
 *   {фамилия}, {жетон}… — значения профиля
 *   {статьи}            — статьи, отмеченные в калькуляторе
 *   {снял|сняла}        — форма по полу
 */
export function renderLine(text: string, profile: Profile, calc: string[] = [], now = new Date()): string {
  const values: Record<string, string> = {
    имя: profile.name,
    фамилия: profile.surname,
    звание: profile.rank,
    подразделение: profile.unit,
    жетон: profile.badge,
    позывной: profile.callsign,
    время: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    дата: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
    статьи: formatCalcArticles(calc)
  }
  return text
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, male: string, female: string) =>
      profile.gender === 'f' ? female : male
    )
    .replace(/\{([\p{L}\p{N}_]+)\}/gu, (whole, key: string) => values[key.toLowerCase()] ?? whole)
}

/** Лимит длины строки в чате RMRP — проверяем с запасом */
export const CHAT_LINE_LIMIT = 150

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const line = (text: string): BindLine => ({ text, delayMs: null })

export const DEFAULT_BINDS: Bind[] = [
  {
    id: 'badge',
    name: 'Показать жетон',
    hotkey: 'Alt+1',
    enterAfterEach: true,
    lines: [line('/do На бронежилете висит жетон «УФСВНГ | {подразделение} | {фамилия} | {жетон}».')]
  },
  {
    id: 'wanted',
    name: 'Выдать розыск по РП',
    hotkey: 'Alt+2',
    enterAfterEach: true,
    lines: [
      line('/do КПК на поясе.'),
      line('/me {снял|сняла} КПК с пояса.'),
      line('/me {включил|включила} КПК и {авторизовался|авторизовалась} в МОССЕТИ.'),
      line('/do КПК включён и авторизован в МОССЕТИ.'),
      line('/me {вбил|вбила} Ф.И.О. задержанного.'),
      line('/do Выдало личное дело.'),
      line('/me {заполнил|заполнила} данные согласно ранее инкриминированным статьям.'),
      line('/do Протокол ареста заполнен.'),
      line('/me {повесил|повесила} КПК на пояс.')
    ]
  },
  {
    id: 'car',
    name: 'Осмотреть машину на взлом',
    hotkey: 'Alt+3',
    enterAfterEach: true,
    lines: [
      line('/do {Осмотрел|Осмотрела} транспортное средство.'),
      line('/me {осмотрел|осмотрела} замок двери Т/С.'),
      line('/do {Достал|Достала} спец. инструмент из нагрудного кармана.'),
      line('/me {начал|начала} проверять замок спец. инструментом.'),
      line('/try {обнаружил|обнаружила} повреждённый замок двери Т/С.'),
      line('/do {Убрал|Убрала} спец. инструмент в нагрудный карман.')
    ]
  },
  {
    id: 'flat',
    name: 'Осмотреть квартиру на взлом',
    hotkey: 'Alt+4',
    enterAfterEach: true,
    lines: [
      line('/do {Осмотрел|Осмотрела} дверь.'),
      line('/me {осмотрел|осмотрела} замок двери.'),
      line('/do {Достал|Достала} спец. инструмент из нагрудного кармана.'),
      line('/me {начал|начала} проверять замок спец. инструментом.'),
      line('/try {обнаружил|обнаружила} повреждённый замок двери.'),
      line('/do {Убрал|Убрала} спец. инструмент в нагрудный карман.')
    ]
  },
  {
    id: 'intro',
    name: 'Представиться',
    hotkey: 'Alt+5',
    enterAfterEach: true,
    lines: [
      line('Здравствуйте! Росгвардия, {звание} {фамилия}.'),
      line('/me {достал|достала} служебное удостоверение и {раскрыл|раскрыла} его перед собеседником'),
      line('/do В удостоверении: {звание} {имя} {фамилия}, {подразделение} УФСВНГ.')
    ]
  },
  {
    id: 'mask-badge',
    name: 'Жетон и позывной (в маске)',
    hotkey: 'Alt+6',
    enterAfterEach: true,
    lines: [
      line('/me {указал|указала} на специальный жетон на бронежилете'),
      line('Росгвардия. Позывной «{позывной}», жетон № {жетон}.')
    ]
  },
  {
    id: 'rights',
    name: 'Права задержанного',
    hotkey: 'Alt+7',
    enterAfterEach: true,
    lines: [
      line('Вы задержаны. Вы вправе не свидетельствовать против себя.'),
      line('Вам положен государственный адвокат. Будете пользоваться этим правом?')
    ]
  },
  {
    id: 'cuffs',
    name: 'Наручники',
    hotkey: 'Alt+8',
    enterAfterEach: true,
    lines: [
      line('/me {снял|сняла} наручники с пояса и {застегнул|застегнула} их на запястьях задержанного'),
      line('/do Наручники застёгнуты.')
    ]
  },
  {
    id: 'search',
    name: 'Личный обыск',
    hotkey: 'Alt+9',
    enterAfterEach: true,
    lines: [
      line('/me {надел|надела} перчатки и {начал|начала} личный обыск задержанного'),
      line('/me {проверил|проверила} карманы и пояс, {прощупал|прощупала} одежду'),
      line('/do Обыск проведён.')
    ]
  },
  {
    id: 'articles',
    name: 'Огласить статьи',
    hotkey: 'Alt+0',
    enterAfterEach: true,
    // ст. 10 ПК: огласить перечень статей. Статьи берутся из калькулятора
    lines: [line('Вы задерживаетесь по статьям: {статьи}.')]
  }
]

export const DEFAULT_CHECKLISTS: Checklist[] = [
  {
    id: 'detention',
    title: 'Задержание',
    source: 'ст. 6–10 ПК',
    steps: [
      'Есть основание по ст. 7 ПК: застигнут, 3+ очевидца, следы, видео, розыск или ориентировка',
      'Спецсредства при необходимости: наручники, дубинка, ЭШУ',
      'Представиться: удостоверение, должность, звание, фамилия (в маске — жетон, номер, позывной)',
      'Огласить статьи, которые вменяются',
      'Предложить государственного адвоката (ст. 8.3 ПК)',
      'Личный обыск (ст. 19 ПК)',
      'Доставить в отдел — на всё задержание не больше 60 минут',
      'Сохранить видеозапись 72 часа (ст. 10.4 ПК)'
    ]
  },
  {
    id: 'arrest',
    title: 'Арест',
    source: 'ст. 18 ПК',
    steps: [
      'Сообщить об аресте, назвать статьи и кратко их описать',
      'Личный обыск, изъять нелегальное в зиплок',
      'Заполнить личное дело: статьи или части статей с указанием кодекса'
    ]
  },
  {
    id: 'official',
    title: 'Задержание госслужащего',
    source: 'ст. 10.3, 12 ПК',
    steps: [
      'Статья есть в перечне ч. 2 ст. 12 ПК — иначе только рапорт прокурору',
      'Вызвать СК, прокуратуру и руководство задержанного — ответ ждать 5 минут',
      'Прибытия ждать до 10 минут',
      'Никто не прибыл — продолжить и передать дело в СК'
    ]
  },
  {
    id: 'vehicle',
    title: 'Остановка транспорта',
    source: 'ст. 57 ПК',
    steps: [
      'Включить проблесковые маячки и следовать за ТС',
      'Потребовать остановиться через рупор',
      'После трёх проигнорированных требований — разрешённые законом силы и средства',
      'Огонь на поражение — только если иначе не остановить (ст. 57.2 ПК)'
    ]
  },
  {
    id: 'weapon',
    title: 'Применение оружия',
    source: 'ст. 25 ПК',
    steps: [
      'Невооружённый — только после двух предупреждений о применении оружия',
      'Вооружённый — предупредить и сделать выстрел в воздух',
      'Явная угроза жизни — можно без предупреждения',
      'Тайзер — после одного предупреждения',
      'После выстрела вызвать скорую или оказать помощь самому'
    ]
  }
]

/** Статьи, которые сразу лежат в «Избранном» */
export const DEFAULT_FAVORITES = [
  'koap:7.2',
  'koap:8.1',
  'koap:8.7',
  'koap:8.12',
  'koap:8.13',
  'uk:44',
  'uk:46',
  'uk:63',
  'uk:90',
  'uk:91',
  'uk:93',
  'pk:7',
  'pk:10',
  'fz34:7',
  'fz86:1'
]

export function defaultProfile(): Profile {
  return {
    id: 'main',
    name: '',
    surname: '',
    rank: 'Рядовой полиции',
    unit: 'АВНГ',
    badge: '',
    callsign: '',
    gender: 'm'
  }
}

export function defaultSettings(): Settings {
  const profile = defaultProfile()
  return {
    version: 1,
    profiles: [profile],
    activeProfileId: profile.id,
    binds: structuredClone(DEFAULT_BINDS),
    hotkeys: { window: 'F1', panel: 'F3', interact: 'F4', stop: 'End' },
    // Паузы как в старом AHK — с ними сервер не кикает за флуд
    chat: { openKey: 'T', method: 'keys', openDelayMs: 200, lineDelayMs: 200, closeWithEnter: true },
    ui: { accent: ACCENTS[0].color, scale: 100, alwaysOnTop: true, autostart: false, lawFontSize: 15 },
    overlay: { x: null, y: null, width: 400, maxHeight: 70, opacity: 94, scale: 100, tab: 'memos', checklistId: 'detention' },
    game: { processNames: ['GTA5.exe', 'GTA5_Enhanced.exe'], classNames: ['grcWindow'] },
    testMode: false,
    onboarded: false,
    favorites: [...DEFAULT_FAVORITES],
    bookmarks: [],
    checklists: structuredClone(DEFAULT_CHECKLISTS),
    checks: {},
    calc: []
  }
}

export function activeProfile(s: Settings): Profile {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? defaultProfile()
}
