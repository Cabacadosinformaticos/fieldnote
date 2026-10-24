import type { EntriesKey } from '../i18n/entries'

export type EntryKind = 'photo' | 'video' | 'audio' | 'text' | 'scale'
export type EntryStatus = 'ready' | 'processing' | 'failed'
export type ActivityCode = 'A1' | 'A2' | 'A3'
export type ScaleType = 'numeric' | 'faces'
export type ParticipantId = string

export type ScaleAnswer = {
  type: ScaleType
  points: number
  labels: string[]
  value: number
  lowLabel: string
  highLabel: string
}

export type RequestTrace = {
  sent: string
  opened: string
  answered: string
}

export type EntryLocation = {
  label: string
  requestedBy: ActivityCode
}

export type EntryPaletteName = 'teal' | 'green' | 'sand'

export type Entry = {
  id: string
  participantId: ParticipantId
  kind: EntryKind
  status: EntryStatus
  activityCode: ActivityCode | null
  free: boolean
  recordedDate: string
  recordedTime: string
  receivedDate: string
  receivedTime: string
  duration?: string
  lateLabel?: string
  tags: string[]
  excerpt: string
  text?: string
  scale?: ScaleAnswer
  palette?: EntryPaletteName
  request?: RequestTrace
  location?: EntryLocation
}

export const entryKindMeta: Record<
  EntryKind,
  { labelKey: EntriesKey; color: string; tint: string }
> = {
  photo: { labelKey: 'kind.photo', color: '#2F5BEA', tint: '#EAF0FF' },
  text: { labelKey: 'kind.text', color: '#5B6478', tint: '#EEF1F6' },
  video: { labelKey: 'kind.video', color: '#131A2A', tint: '#E6EAF3' },
  audio: { labelKey: 'kind.audio', color: '#0E7C66', tint: '#E3F4EC' },
  scale: { labelKey: 'kind.scale', color: '#B96A00', tint: '#FFF3D6' },
}

export const entryStatusMeta: Record<EntryStatus, { labelKey: EntriesKey; tone: string }> = {
  ready: { labelKey: 'status.ready', tone: 'ok' },
  processing: { labelKey: 'status.processing', tone: 'wa' },
  failed: { labelKey: 'status.failed', tone: 'da' },
}

export const entryTags = [
  'sombra',
  'ocupação',
  'percurso',
  'acessos',
  'eventos',
  'sozinho',
  'com família',
] as const

export type EntryTag = (typeof entryTags)[number]

export const entryParticipants: ParticipantId[] = Array.from(
  { length: 24 },
  (_, index) => `P-${String(index + 1).padStart(2, '0')}`,
)

export const entryActivities: { code: ActivityCode; title: string }[] = [
  { code: 'A1', title: 'Um momento no jardim' },
  { code: 'A2', title: 'O que o trouxe ao jardim?' },
  { code: 'A3', title: 'Como se sente agora?' },
]

export function activityFullLabel(code: ActivityCode | null, free = false): string {
  if (!code) {
    return 'Registo livre'
  }

  const activity = entryActivities.find((item) => item.code === code)
  return `${code} · ${free ? 'registo livre' : activity?.title ?? ''}`
}

export const numericScale7: Omit<ScaleAnswer, 'value'> = {
  type: 'numeric',
  points: 7,
  labels: ['1, muito mal', '2', '3', '4', '5', '6', '7, muito bem'],
  lowLabel: 'Muito mal',
  highLabel: 'Muito bem',
}

export const facesScale4: Omit<ScaleAnswer, 'value'> = {
  type: 'faces',
  points: 4,
  labels: ['Muito mal', 'Mal', 'Bem', 'Muito bem'],
  lowLabel: 'Muito mal',
  highLabel: 'Muito bem',
}

export function makeScale(template: Omit<ScaleAnswer, 'value'>, value: number): ScaleAnswer {
  return { ...template, value }
}

export const entryPalettes: Record<
  EntryPaletteName,
  { sky: string; sun: string; far: string; near: string; trunk: string; tree: string; tree2: string }
> = {
  teal: {
    sky: '#D7E5E8',
    sun: '#F1E4B8',
    far: '#A9C9CF',
    near: '#6A9FA8',
    trunk: '#3F7480',
    tree: '#3F7480',
    tree2: '#6A9FA8',
  },
  green: {
    sky: '#CFE3D2',
    sun: '#EBD9A8',
    far: '#9CC3A6',
    near: '#5E9470',
    trunk: '#3E7352',
    tree: '#3E7352',
    tree2: '#5E9470',
  },
  sand: {
    sky: '#E8E1CB',
    sun: '#D9B66B',
    far: '#CDBF94',
    near: '#9DAA72',
    trunk: '#5F7F52',
    tree: '#5F7F52',
    tree2: '#9DAA72',
  },
}

const MONTHS_SHORT = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
]

const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const WEEKDAYS_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

function splitDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number)
  return { year, month, day }
}

export function weekdayIndex(isoDate: string): number {
  const { year, month, day } = splitDate(isoDate)
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

export function weekdayShort(isoDate: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(isoDate)]
}

export function formatShortDate(isoDate: string): string {
  const { month, day } = splitDate(isoDate)
  return `${day} ${MONTHS_SHORT[month - 1]}`
}

export function formatLongDate(isoDate: string): string {
  const { month, day } = splitDate(isoDate)
  return `${WEEKDAYS_LONG[weekdayIndex(isoDate)]}, ${day} de ${MONTHS_LONG[month - 1]}`
}

export function formatMonthDay(isoDate: string): string {
  const { month, day } = splitDate(isoDate)
  return `${day} de ${MONTHS_LONG[month - 1]}`
}

export function formatStamp(isoDate: string, time: string): string {
  const { month, day } = splitDate(isoDate)
  return `${day} ${MONTHS_SHORT[month - 1]} ${time}`
}

export function formatReceived(entry: Entry): string {
  return entry.receivedDate === entry.recordedDate
    ? entry.receivedTime
    : formatStamp(entry.receivedDate, entry.receivedTime)
}

export function addDays(isoDate: string, delta: number): string {
  const { year, month, day } = splitDate(isoDate)
  const date = new Date(Date.UTC(year, month - 1, day + delta, 12))
  return date.toISOString().slice(0, 10)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export const entriesStudy = {
  id: 'jardim-da-estrela',
  startDate: '2026-10-06',
  today: '2026-10-09',
  totalDays: 14,
  timezone: 'Europe/Lisboa',
  now: '14:32',
  dateRange: '6 a 9 out.',
}

const featuredEntries: Entry[] = [
  {
    id: 'e01',
    participantId: 'P-03',
    kind: 'video',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '11:32',
    receivedDate: '2026-10-09',
    receivedTime: '11:33',
    duration: '0:48',
    tags: ['sombra'],
    excerpt: '“Estou no banco perto do coreto. Há sombra e pouca gente a passar.”',
    palette: 'teal',
    request: { sent: '11:25', opened: '11:27', answered: '11:32' },
    location: { label: 'Jardim da Estrela, Lisboa', requestedBy: 'A1' },
  },
  {
    id: 'e02',
    participantId: 'P-09',
    kind: 'video',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '13:05',
    receivedDate: '2026-10-09',
    receivedTime: '13:05',
    duration: '0:48',
    tags: ['sombra', 'ocupação'],
    excerpt:
      '“Os bancos à sombra estão todos ocupados e há muita gente a passar pelo caminho do lago.”',
    palette: 'green',
    request: { sent: '13:00', opened: '13:02', answered: '13:05' },
    location: { label: 'Jardim da Estrela, Lisboa', requestedBy: 'A1' },
  },
  {
    id: 'e03',
    participantId: 'P-12',
    kind: 'photo',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '12:05',
    receivedDate: '2026-10-09',
    receivedTime: '12:06',
    tags: ['ocupação'],
    excerpt: '“A relva junto ao lago está cheia de gente a fazer piquenique.”',
    palette: 'sand',
    request: { sent: '12:00', opened: '12:01', answered: '12:05' },
    location: { label: 'Jardim da Estrela, Lisboa', requestedBy: 'A1' },
  },
  {
    id: 'e04',
    participantId: 'P-22',
    kind: 'text',
    status: 'ready',
    activityCode: 'A2',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '12:47',
    receivedDate: '2026-10-09',
    receivedTime: '12:47',
    tags: ['com família'],
    excerpt: '“Vim buscar o meu filho à escola e passei pelo jardim.”',
    text: '“Vim buscar o meu filho à escola e passei pelo jardim.”',
    request: { sent: '12:40', opened: '12:42', answered: '12:47' },
  },
  {
    id: 'e05',
    participantId: 'P-05',
    kind: 'audio',
    status: 'ready',
    activityCode: 'A2',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '13:07',
    receivedDate: '2026-10-09',
    receivedTime: '13:07',
    duration: '0:41',
    tags: [],
    excerpt: '“Costumo vir aqui depois do almoço, para ler um pouco à sombra.”',
    request: { sent: '13:00', opened: '13:01', answered: '13:07' },
  },
  {
    id: 'e06',
    participantId: 'P-20',
    kind: 'photo',
    status: 'ready',
    activityCode: 'A1',
    free: true,
    recordedDate: '2026-10-09',
    recordedTime: '11:48',
    receivedDate: '2026-10-09',
    receivedTime: '11:48',
    tags: ['acessos'],
    excerpt: '“A entrada sul tem rampa nova, mas o portão continua estreito.”',
    palette: 'teal',
    location: { label: 'Entrada sul, Jardim da Estrela', requestedBy: 'A1' },
  },
  {
    id: 'e07',
    participantId: 'P-16',
    kind: 'photo',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '09:41',
    receivedDate: '2026-10-09',
    receivedTime: '11:54',
    tags: [],
    excerpt: '“O coreto está fechado para obras e ninguém consegue passar.”',
    palette: 'teal',
    lateLabel: 'Chegou 2 h 13 min depois',
    request: { sent: '09:35', opened: '09:37', answered: '09:41' },
    location: { label: 'Coreto, Jardim da Estrela', requestedBy: 'A1' },
  },
  {
    id: 'e08',
    participantId: 'P-10',
    kind: 'scale',
    status: 'ready',
    activityCode: 'A3',
    free: false,
    recordedDate: '2026-10-08',
    recordedTime: '21:12',
    receivedDate: '2026-10-08',
    receivedTime: '21:12',
    tags: [],
    excerpt: '5 de 7',
    scale: makeScale(numericScale7, 5),
    request: { sent: '21:00', opened: '21:04', answered: '21:12' },
  },
  {
    id: 'e09',
    participantId: 'P-13',
    kind: 'video',
    status: 'processing',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '14:10',
    receivedDate: '2026-10-09',
    receivedTime: '14:11',
    duration: '0:31',
    tags: [],
    excerpt: '“A fila para o baloiço já dá a volta ao parque.”',
    palette: 'sand',
    request: { sent: '14:05', opened: '14:06', answered: '14:10' },
  },
  {
    id: 'e10',
    participantId: 'P-09',
    kind: 'video',
    status: 'failed',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-08',
    recordedTime: '19:12',
    receivedDate: '2026-10-08',
    receivedTime: '19:12',
    duration: '0:31',
    tags: [],
    excerpt: '“Ao fim do dia há mais cães do que pessoas no relvado.”',
    palette: 'green',
    request: { sent: '19:00', opened: '19:02', answered: '19:12' },
  },
  {
    id: 'e11',
    participantId: 'P-17',
    kind: 'text',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '08:30',
    receivedDate: '2026-10-09',
    receivedTime: '08:30',
    tags: ['sozinho'],
    excerpt: '“Cheguei cedo, o parque infantil ainda estava vazio.”',
    text: '“Cheguei cedo, o parque infantil ainda estava vazio.”',
    request: { sent: '08:25', opened: '08:26', answered: '08:30' },
  },
  {
    id: 'e12',
    participantId: 'P-03',
    kind: 'photo',
    status: 'ready',
    activityCode: 'A1',
    free: false,
    recordedDate: '2026-10-09',
    recordedTime: '09:15',
    receivedDate: '2026-10-09',
    receivedTime: '09:15',
    tags: ['percurso'],
    excerpt: '“O caminho do lago está molhado, ainda da rega da manhã.”',
    palette: 'green',
    request: { sent: '09:10', opened: '09:11', answered: '09:15' },
    location: { label: 'Caminho do lago, Jardim da Estrela', requestedBy: 'A1' },
  },
]

const quotes = [
  '“Hoje o jardim está calmo, quase só vejo quem passeia o cão.”',
  '“Sentei-me num banco ao sol porque a sombra estava toda ocupada.”',
  '“Há uma feira de artesanato a montar as bancas junto à entrada.”',
  '“O lago tem patos novos e as crianças param todas a ver.”',
  '“Não há sombra nenhuma neste lado do relvado.”',
  '“O café do jardim já fechou e os bancos ficaram vazios.”',
  '“Passei só para atravessar, mas demorei mais do que esperava.”',
  '“Está muito vento, as pessoas estão a sair aos poucos.”',
]

const primaryTags = [
  ...Array<string>(12).fill('sombra'),
  ...Array<string>(9).fill('ocupação'),
  ...Array<string>(8).fill('percurso'),
  ...Array<string>(5).fill('acessos'),
  ...Array<string>(5).fill('eventos'),
]

function generatedTags(index: number): string[] {
  const tags: string[] = []
  if (index < primaryTags.length) {
    tags.push(primaryTags[index])
  }
  if (index < 3) {
    tags.push('sozinho')
  } else if (index < 9) {
    tags.push('com família')
  }
  return tags
}

const generatedEntries: Entry[] = Array.from({ length: 256 }, (_, index) => {
  const kinds: EntryKind[] = ['photo', 'video', 'audio', 'text', 'scale']
  const kind = kinds[index % kinds.length]
  const free = index < 48
  const activityCode = (['A1', 'A2', 'A3'] as ActivityCode[])[index % 3]
  const date = `2026-10-${String(6 + (index % 4)).padStart(2, '0')}`
  const minutes = 8 * 60 + ((index * 37) % (14 * 60))
  const time = minutesToTime(minutes)
  const late = index >= 100 && index < 137
  const receivedMinutes = minutes + (late ? 133 : 1)
  const receivedDate = receivedMinutes >= 1440 ? addDays(date, 1) : date
  const receivedTime = minutesToTime(receivedMinutes % 1440)
  const tags = generatedTags(index)
  const duration =
    kind === 'video' || kind === 'audio'
      ? `0:${String(20 + ((index * 7) % 40)).padStart(2, '0')}`
      : undefined
  const scale =
    kind === 'scale'
      ? makeScale(index % 2 === 0 ? numericScale7 : facesScale4, 1 + (index % (index % 2 === 0 ? 7 : 4)))
      : undefined
  const text = kind === 'text' ? quotes[index % quotes.length] : undefined
  const excerpt =
    text ??
    (kind === 'scale'
      ? `${scale?.value} de ${scale?.points}`
      : kind === 'photo'
        ? 'Foto · Jardim da Estrela'
        : kind === 'video'
          ? 'Vídeo · Jardim da Estrela'
          : 'Áudio · Jardim da Estrela')

  return {
    id: `g${String(index + 1).padStart(3, '0')}`,
    participantId: entryParticipants[index % entryParticipants.length],
    kind,
    status: 'ready',
    activityCode,
    free,
    recordedDate: date,
    recordedTime: time,
    receivedDate,
    receivedTime,
    duration,
    tags,
    excerpt,
    text,
    scale,
    palette: (['teal', 'green', 'sand'] as EntryPaletteName[])[index % 3],
    lateLabel: late ? 'Chegou 2 h 13 min depois' : undefined,
    request: free
      ? undefined
      : {
          sent: minutesToTime(minutes - 8),
          opened: minutesToTime(minutes - 5),
          answered: time,
        },
    location:
      !free && (kind === 'photo' || kind === 'video') && index % 4 === 0
        ? { label: 'Jardim da Estrela, Lisboa', requestedBy: activityCode }
        : undefined,
  }
})

export const entries: Entry[] = [...featuredEntries, ...generatedEntries]

export const defaultSelectedEntryId = 'e02'

const kindCounts = entries.reduce<Record<EntryKind, number>>(
  (counts, entry) => {
    counts[entry.kind] += 1
    return counts
  },
  { photo: 0, text: 0, video: 0, audio: 0, scale: 0 },
)

const tagCounts = entryTags.map((tag) => ({
  tag,
  count: entries.filter((entry) => entry.tags.includes(tag)).length,
}))

export const entryStats = {
  total: entries.length,
  tagged: entries.filter((entry) => entry.tags.length > 0).length,
  free: entries.filter((entry) => entry.free).length,
  late: entries.filter((entry) => entry.lateLabel !== undefined).length,
  kindCounts,
  tagCounts,
  dateRange: entriesStudy.dateRange,
}

export function entryMatchesSearch(entry: Entry, query: string): boolean {
  const haystack = [
    entry.participantId,
    entry.excerpt,
    entry.text ?? '',
    entry.tags.join(' '),
    activityFullLabel(entry.activityCode, entry.free),
    entryKindMeta[entry.kind].labelKey,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.trim().toLowerCase())
}

export type ExportOptionId = 'location' | 'media' | 'identity'

export type ExportRecord = {
  id: string
  who: string
  when: string
  count: number
  options: ExportOptionId[]
  format: string
}

export const exportCurrentUser = 'Inês Marques'

export const previousExports: ExportRecord[] = [
  {
    id: 'x1',
    who: 'Duarte Lopes',
    when: '8 out. 17:42',
    count: 231,
    options: ['location', 'media'],
    format: 'CSV',
  },
  {
    id: 'x2',
    who: 'Inês Marques',
    when: '8 out. 10:05',
    count: 158,
    options: ['identity'],
    format: 'CSV',
  },
  {
    id: 'x3',
    who: 'Inês Marques',
    when: '7 out. 09:15',
    count: 96,
    options: [],
    format: 'CSV',
  },
]

export const exportPreviewRows = [entries[2], entries[3], entries[7], entries[1]]

export function previewContent(entry: Entry): string {
  if (entry.kind === 'text') {
    return entry.text ?? entry.excerpt
  }
  if (entry.kind === 'scale' && entry.scale) {
    return String(entry.scale.value)
  }
  return '(sem ficheiro)'
}

export function previewPrompt(entry: Entry): string {
  return entry.request ? formatStamp(entry.recordedDate, entry.request.sent) : '–'
}

export function previewTimestamp(entry: Entry, which: 'recorded' | 'received'): string {
  const date = which === 'recorded' ? entry.recordedDate : entry.receivedDate
  const time = which === 'recorded' ? entry.recordedTime : entry.receivedTime
  return `${date} ${time}`
}

export type TimelineKind = EntryKind | 'request'

export type TimelineItem = {
  id: string
  participantId: ParticipantId
  date: string
  time: string
  kind: TimelineKind
  free: boolean
  activityCode: ActivityCode | null
  title: string
  excerpt: string
  tag?: string
  duration?: string
}

function makeTimelineItem(
  id: string,
  participantNumber: number,
  date: string,
  time: string,
  kind: TimelineKind,
  activityCode: ActivityCode | null,
  free: boolean,
  excerpt: string,
  tag?: string,
  duration?: string,
): TimelineItem {
  return {
    id,
    participantId: `P-${String(participantNumber).padStart(2, '0')}`,
    date,
    time,
    kind,
    free,
    activityCode,
    title: activityFullLabel(activityCode, free),
    excerpt,
    tag,
    duration,
  }
}

type DaySeed = [
  number,
  string,
  TimelineKind,
  ActivityCode | null,
  boolean,
  string,
  string?,
  string?,
]

const daySeeds: DaySeed[] = [
  [1, '09:05', 'photo', 'A1', false, 'Foto · etiqueta sombra', 'sombra'],
  [1, '11:30', 'scale', 'A3', false, '5 de 7'],
  [1, '14:11', 'photo', 'A1', false, 'Foto · etiqueta ocupação', 'ocupação'],
  [2, '08:40', 'audio', 'A2', false, 'Áudio de 0:29', undefined, '0:29'],
  [2, '11:15', 'photo', 'A1', false, 'Foto · etiqueta percurso', 'percurso'],
  [2, '13:25', 'photo', 'A1', true, 'Foto livre · etiqueta acessos', 'acessos'],
  [3, '09:15', 'photo', 'A1', false, 'Foto · etiqueta percurso', 'percurso'],
  [3, '11:32', 'video', 'A1', false, 'Vídeo de 0:48 · etiqueta sombra', 'sombra', '0:48'],
  [3, '12:10', 'text', 'A1', true, '“O banco à sombra acabou de ficar livre.”'],
  [5, '09:00', 'photo', 'A1', false, 'Foto · etiqueta sozinho', 'sozinho'],
  [5, '11:05', 'request', 'A2', false, ''],
  [5, '13:07', 'audio', 'A2', false, 'Áudio de 0:41', undefined, '0:41'],
  [6, '08:50', 'scale', 'A3', false, '6 de 7'],
  [6, '10:55', 'text', 'A1', false, '“Cheguei cedo, o parque infantil estava vazio.”'],
  [6, '13:05', 'video', 'A1', false, 'Vídeo de 0:31 · etiqueta com família', 'com família', '0:31'],
  [7, '09:20', 'request', 'A1', false, ''],
  [7, '13:20', 'request', 'A1', false, ''],
  [8, '09:35', 'text', 'A1', true, '“Primeiro café da manhã ao ar livre.”'],
  [8, '10:10', 'text', 'A2', false, '“Venho sempre antes de ir trabalhar.”'],
  [8, '12:15', 'scale', 'A3', false, '6 de 7'],
  [8, '14:19', 'photo', 'A1', false, 'Foto · etiqueta sombra', 'sombra'],
]

const dayItems: TimelineItem[] = daySeeds.map((seed, index) =>
  makeTimelineItem(
    `t-d9-${index}`,
    seed[0],
    '2026-10-09',
    seed[1],
    seed[2],
    seed[3],
    seed[4],
    seed[5],
    seed[6],
    seed[7],
  ),
)

const weekCodes: Record<number, string[]> = {
  1: ['f t e', 'f e v', 'f a e t*'],
  2: ['a f', 'a f e', 't f e f*'],
  3: ['f v e', 'f t', 'v f e'],
  4: ['f e', 't f e', 'v f e'],
  5: ['f a e', 'f x a', 'f a e'],
  6: ['e t v', 'e t', 'e f x'],
  7: ['f t e', 'f t e', 'x x x'],
  8: ['t e f', 'a e f f*', 't e f'],
}

const weekCodeKinds: Record<string, TimelineKind> = {
  f: 'photo',
  t: 'text',
  v: 'video',
  a: 'audio',
  e: 'scale',
  x: 'request',
}

const weekTimes = [
  ['09:05', '11:30', '14:11', '16:00'],
  ['08:40', '11:15', '13:25', '16:10'],
  ['09:15', '11:32', '12:10', '14:00'],
]

const weekTagByKind: Partial<Record<TimelineKind, string>> = {
  photo: 'sombra',
  text: 'com família',
  video: 'percurso',
  audio: 'acessos',
  scale: 'eventos',
}

function weekExcerpt(kind: TimelineKind, free: boolean, index: number): string {
  if (kind === 'request') {
    return ''
  }
  if (kind === 'text') {
    return quotes[index % quotes.length]
  }
  if (kind === 'photo') {
    return free ? 'Foto livre no jardim' : 'Foto · etiqueta sombra'
  }
  if (kind === 'video') {
    return 'Vídeo de 0:31'
  }
  if (kind === 'audio') {
    return 'Áudio de 0:29'
  }
  return index % 2 === 0 ? '5 de 7' : '6 de 7'
}

const weekItems: TimelineItem[] = []

for (let participant = 1; participant <= 8; participant += 1) {
  const days = weekCodes[participant]
  days.forEach((codes, dayIndex) => {
    codes.split(' ').forEach((code, itemIndex) => {
      const free = code.endsWith('*')
      const kind = weekCodeKinds[code[0]] ?? 'photo'
      const time = weekTimes[dayIndex][itemIndex] ?? '17:00'
      weekItems.push(
        makeTimelineItem(
          `t-w${participant}-${dayIndex}-${itemIndex}`,
          participant,
          `2026-10-${String(6 + dayIndex).padStart(2, '0')}`,
          time,
          kind,
          kind === 'request' ? 'A1' : (['A1', 'A2', 'A3'] as ActivityCode[])[itemIndex % 3],
          free,
          weekExcerpt(kind, free, itemIndex),
          kind === 'request' ? undefined : weekTagByKind[kind],
          kind === 'video' || kind === 'audio' ? '0:31' : undefined,
        ),
      )
    })
  })
}

export const timelineItems: TimelineItem[] = [...weekItems, ...dayItems]

export const defaultTimelineSelectionId = 't-d9-7'

export type PlannedPrompt = {
  id: string
  participantId: ParticipantId
  date: string
  time: string
}

export const plannedPrompts: PlannedPrompt[] = [
  { id: 'pp1', participantId: 'P-02', date: '2026-10-09', time: '17:00' },
  { id: 'pp2', participantId: 'P-03', date: '2026-10-09', time: '16:50' },
  { id: 'pp3', participantId: 'P-04', date: '2026-10-09', time: '16:20' },
  { id: 'pp4', participantId: 'P-04', date: '2026-10-09', time: '19:10' },
  { id: 'pp5', participantId: 'P-04', date: '2026-10-09', time: '21:15' },
  { id: 'pp6', participantId: 'P-06', date: '2026-10-09', time: '16:10' },
  { id: 'pp7', participantId: 'P-07', date: '2026-10-09', time: '15:45' },
]

export const participantBand = {
  participantId: 'P-04',
  start: '16:00',
  end: '22:00',
}

export const timelineStudy = {
  startDate: '2026-10-06',
  today: '2026-10-09',
  totalDays: 14,
  totalParticipants: entryParticipants.length,
  timezone: 'Europe/Lisboa',
  now: '14:32',
  dayStart: 8,
  dayEnd: 22,
  hoursStart: 12,
  hoursEnd: 15,
}
