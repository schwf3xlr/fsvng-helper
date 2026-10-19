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

export type HotkeyAction = 'window' | 'glass' | 'memos' | 'stop'

export const HOTKEY_ACTIONS: { id: HotkeyAction; label: string; hint?: string }[] = [
  { id: 'window', label: 'Показать / скрыть окно' },
  { id: 'glass', label: 'Режим «стекло»', hint: 'окно поверх игры, клики проходят в игру' },
  { id: 'memos', label: 'Памятки поверх игры', hint: 'открыть «стекло» на вкладке «Памятки»' },
  { id: 'stop', label: 'Остановить отыгровку' }
]

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
    glassOpacity: number
    scale: number
    alwaysOnTop: boolean
    autostart: boolean
    lawFontSize: number
  }
  game: {
    processNames: string[]
    classNames: string[]
  }
  /** Бинды и хоткеи работают в любом окне — для проверки без игры */
  testMode: boolean
  /** Избранные памятки: "uk:44", "koap:8.7", "pk:10" */
  favorites: string[]
  /** Закладки в тексте законов: "uk:44" */
  bookmarks: string[]
  checklists: Checklist[]
  /** Отметки в чек-листах: id → номера отмеченных шагов */
  checks: Record<string, number[]>
}

export const ACCENTS = [
  { color: '#E0B04A', label: 'Золото' },
  { color: '#7FB2F0', label: 'Небо' },
  { color: '#79C7B5', label: 'Мята' },
  { color: '#B9A2F0', label: 'Лаванда' }
]

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
  { token: '{дата}', label: 'Дата' }
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Подставляет профиль в строку отыгровки.
 *   {фамилия}, {жетон}… — значения профиля
 *   {снял|сняла}        — форма по полу
 */
export function renderLine(text: string, profile: Profile, now = new Date()): string {
  const values: Record<string, string> = {
    имя: profile.name,
    фамилия: profile.surname,
    звание: profile.rank,
    подразделение: profile.unit,
    жетон: profile.badge,
    позывной: profile.callsign,
    время: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    дата: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
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
  'pk:10'
]

export function defaultProfile(): Profile {
  return {
    id: 'main',
    name: '',
    surname: 'Колыван',
    rank: 'Сержант полиции',
    unit: 'ОМОН',
    badge: '73',
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
    hotkeys: { window: 'F1', glass: 'Ctrl+F1', memos: 'F3', stop: 'End' },
    // Паузы как в старом AHK — с ними сервер не кикает за флуд
    chat: { openKey: 'T', method: 'keys', openDelayMs: 200, lineDelayMs: 200, closeWithEnter: true },
    ui: { accent: ACCENTS[0].color, glassOpacity: 85, scale: 100, alwaysOnTop: true, autostart: false, lawFontSize: 15 },
    game: { processNames: ['GTA5.exe', 'GTA5_Enhanced.exe'], classNames: ['grcWindow'] },
    testMode: false,
    favorites: [...DEFAULT_FAVORITES],
    bookmarks: [],
    checklists: structuredClone(DEFAULT_CHECKLISTS),
    checks: {}
  }
}

export function activeProfile(s: Settings): Profile {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0] ?? defaultProfile()
}
