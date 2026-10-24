import type { ParticipantsKey } from '../i18n/participants'

export type PillTone = 'ok' | 'wa' | 'ne' | 'da' | 'pr'

export type ParticipantStatus =
  | 'active'
  | 'inviteUnused'
  | 'inviteExpired'
  | 'consentPending'
  | 'declined'
  | 'withdrawn'
  | 'erased'
  | 'left'
  | 'deleting'

export const participantStatusMeta: Record<
  ParticipantStatus,
  { labelKey: ParticipantsKey; pill: PillTone }
> = {
  active: { labelKey: 'status.active', pill: 'ok' },
  inviteUnused: { labelKey: 'status.inviteUnused', pill: 'wa' },
  inviteExpired: { labelKey: 'status.inviteExpired', pill: 'ne' },
  consentPending: { labelKey: 'status.consentPending', pill: 'wa' },
  declined: { labelKey: 'status.declined', pill: 'ne' },
  withdrawn: { labelKey: 'status.withdrawn', pill: 'ne' },
  erased: { labelKey: 'status.erased', pill: 'ne' },
  left: { labelKey: 'status.left', pill: 'ne' },
  deleting: { labelKey: 'status.deleting', pill: 'ne' },
}

export type FilterKey = 'all' | ParticipantStatus

export const participantFilters: { key: FilterKey; labelKey: ParticipantsKey }[] = [
  { key: 'all', labelKey: 'list.filterLabel' },
  { key: 'active', labelKey: 'status.active' },
  { key: 'inviteUnused', labelKey: 'status.inviteUnused' },
  { key: 'inviteExpired', labelKey: 'status.inviteExpired' },
  { key: 'consentPending', labelKey: 'status.consentPending' },
  { key: 'declined', labelKey: 'status.declined' },
  { key: 'withdrawn', labelKey: 'status.withdrawn' },
  { key: 'erased', labelKey: 'status.erased' },
  { key: 'left', labelKey: 'status.left' },
  { key: 'deleting', labelKey: 'status.deleting' },
]

export const filterLabelOverrides: Partial<Record<FilterKey, string>> = {
  all: 'Todos',
}

export interface AdherenceDay {
  answered: number
  sent: number
}

export type EntryMethod = 'qr' | 'written'

export interface Participant {
  id: string
  status: ParticipantStatus
  entry: EntryMethod | null
  consent: string
  language: 'PT' | 'EN'
  hours: string
  days: (AdherenceDay | null)[]
  lastEntry: string
  lastEntryAlert?: boolean
  noteKey?: 'list.inviteUnusedNote' | 'list.declinedNote'
}

const day = (answered: number, sent: number): AdherenceDay => ({ answered, sent })

export const studyName = 'Viver o Jardim da Estrela'

export const participants: Participant[] = [
  { id: 'P-01', status: 'active', entry: 'qr', consent: '6 out. 10:14', language: 'PT', hours: '09:00–21:30', days: [day(4, 4), day(4, 4), day(3, 4), day(2, 2)], lastEntry: 'hoje 14:11' },
  { id: 'P-02', status: 'active', entry: 'qr', consent: '6 out. 11:02', language: 'PT', hours: '08:30–21:00', days: [day(3, 4), day(3, 4), day(3, 4), day(1, 2)], lastEntry: 'hoje 10:04' },
  { id: 'P-03', status: 'active', entry: 'written', consent: '6 out. 11:40', language: 'PT', hours: '09:00–22:00', days: [day(3, 4), day(3, 4), day(4, 4), day(2, 3)], lastEntry: 'hoje 12:48' },
  { id: 'P-04', status: 'active', entry: 'qr', consent: '6 out. 18:22', language: 'PT', hours: '16:00–22:00', days: [day(2, 3), day(3, 3), day(2, 3), null], lastEntry: '8 out. 21:12' },
  { id: 'P-05', status: 'active', entry: 'qr', consent: '6 out. 12:31', language: 'EN', hours: '09:00–21:00', days: [day(3, 4), day(3, 4), day(3, 4), day(2, 2)], lastEntry: 'hoje 13:07' },
  { id: 'P-06', status: 'active', entry: 'written', consent: '6 out. 13:05', language: 'PT', hours: '10:00–22:00', days: [day(3, 4), day(3, 4), day(3, 4), day(1, 2)], lastEntry: 'hoje 09:52' },
  { id: 'P-07', status: 'active', entry: 'qr', consent: '6 out. 11:02', language: 'PT', hours: '10:00–21:00', days: [day(3, 4), day(2, 4), day(0, 4), day(0, 2)], lastEntry: '7 out. 18:40', lastEntryAlert: true },
  { id: 'P-08', status: 'active', entry: 'qr', consent: '6 out. 14:50', language: 'PT', hours: '09:00–21:30', days: [day(3, 4), day(3, 4), day(3, 4), day(1, 1)], lastEntry: 'hoje 14:19' },
  { id: 'P-09', status: 'active', entry: 'written', consent: '6 out. 15:10', language: 'PT', hours: '09:30–21:30', days: [day(3, 4), day(3, 4), day(2, 4), day(2, 2)], lastEntry: 'hoje 13:05' },
  { id: 'P-10', status: 'active', entry: 'qr', consent: '6 out. 16:44', language: 'PT', hours: '09:00–22:00', days: [day(3, 4), day(3, 4), day(4, 4), day(2, 2)], lastEntry: 'hoje 13:21' },
  { id: 'P-11', status: 'active', entry: 'qr', consent: '6 out. 09:15', language: 'PT', hours: '16:00–22:00', days: [day(3, 3), day(2, 3), day(3, 3), null], lastEntry: '8 out. 20:48' },
  { id: 'P-12', status: 'active', entry: 'written', consent: '6 out. 09:48', language: 'PT', hours: '09:00–21:30', days: [day(3, 4), day(4, 4), day(3, 4), day(2, 3)], lastEntry: 'hoje 12:05' },
  { id: 'P-13', status: 'active', entry: 'qr', consent: '6 out. 10:20', language: 'PT', hours: '09:00–21:30', days: [day(3, 4), day(3, 4), day(3, 4), day(2, 2)], lastEntry: 'hoje 12:55' },
  { id: 'P-14', status: 'active', entry: 'qr', consent: '6 out. 17:30', language: 'PT', hours: '09:00–21:30', days: [day(4, 4), day(3, 4), day(2, 4), day(2, 3)], lastEntry: 'hoje 14:02' },
  { id: 'P-15', status: 'active', entry: 'written', consent: '6 out. 12:01', language: 'PT', hours: '10:00–22:00', days: [day(3, 4), day(3, 4), day(3, 4), day(1, 1)], lastEntry: 'hoje 09:48' },
  { id: 'P-16', status: 'active', entry: 'qr', consent: '6 out. 14:33', language: 'EN', hours: '09:00–21:00', days: [day(3, 4), day(3, 4), day(3, 4), day(2, 2)], lastEntry: 'hoje 14:06' },
  { id: 'P-17', status: 'active', entry: 'qr', consent: '6 out. 15:12', language: 'PT', hours: '08:00–21:30', days: [day(3, 4), day(4, 4), day(3, 4), day(1, 2)], lastEntry: 'hoje 13:41' },
  { id: 'P-18', status: 'active', entry: 'written', consent: '6 out. 16:00', language: 'PT', hours: '09:00–21:30', days: [day(3, 4), day(3, 4), day(3, 4), day(1, 2)], lastEntry: 'hoje 09:40' },
  { id: 'P-19', status: 'active', entry: 'qr', consent: '6 out. 12:44', language: 'PT', hours: '09:00–21:00', days: [day(2, 4), day(1, 4), day(0, 4), day(0, 2)], lastEntry: '7 out. 13:05', lastEntryAlert: true },
  { id: 'P-20', status: 'active', entry: 'qr', consent: '6 out. 17:20', language: 'PT', hours: '09:00–21:30', days: [day(4, 4), day(3, 4), day(3, 4), day(2, 3)], lastEntry: 'hoje 11:48' },
  { id: 'P-21', status: 'active', entry: 'written', consent: '6 out. 09:05', language: 'EN', hours: '10:00–21:00', days: [day(3, 4), day(2, 4), day(3, 4), day(1, 1)], lastEntry: 'hoje 14:27' },
  { id: 'P-22', status: 'active', entry: 'qr', consent: '6 out. 10:12', language: 'PT', hours: '10:00–22:00', days: [day(3, 4), day(3, 4), day(3, 4), day(2, 2)], lastEntry: 'hoje 11:49' },
  { id: 'P-23', status: 'inviteUnused', entry: null, consent: '–', language: 'PT', hours: '–', days: [null, null, null, null], lastEntry: '–', noteKey: 'list.inviteUnusedNote' },
  { id: 'P-24', status: 'declined', entry: 'written', consent: '7 out. 20:03', language: 'PT', hours: '–', days: [null, null, null, null], lastEntry: '–', noteKey: 'list.declinedNote' },
]

export function participantsForFilter(key: FilterKey): Participant[] {
  return key === 'all' ? participants : participants.filter((item) => item.status === key)
}

export function participantFilterCount(key: FilterKey): number {
  return participantsForFilter(key).length
}

export function searchParticipants(list: Participant[], query: string): Participant[] {
  const term = query.trim().toLowerCase()
  return term ? list.filter((item) => item.id.toLowerCase().includes(term)) : list
}

export function findParticipant(id: string): Participant | undefined {
  return participants.find((item) => item.id === id)
}

export function adherenceTone(answered: number, sent: number): 'ok' | 'wa' | 'da' {
  if (sent === 0) return 'da'
  const ratio = answered / sent
  if (ratio >= 0.75) return 'ok'
  if (ratio >= 0.5) return 'wa'
  return 'da'
}

export type MatrixState = 'answered' | 'expired' | 'pending' | 'notSent'

export interface ParticipantDetail {
  participant: Participant
  consentLabel: string
  totals: { answered: number; sent: number; percent: number }
  freeCount: number
  matrix: MatrixState[][]
  free: (number | null)[]
  gap: { last: string; sentToday: number } | null
  identity: { name: string; email: string }
  weekday: string[]
  weekend: string
  phoneLast: string
}

const identityNames = [
  ['Helena Faria', 'helena.faria@example.pt'],
  ['Tiago Melo', 'tiago.melo@example.pt'],
  ['Sara Pinto', 'sara.pinto@example.pt'],
  ['André Lopes', 'andre.lopes@example.pt'],
  ['Beatriz Nunes', 'beatriz.nunes@example.pt'],
] as const

const p07Matrix: MatrixState[][] = [
  ['expired', 'expired', 'expired', 'expired'],
  ['answered', 'answered', 'expired', 'pending'],
  ['answered', 'answered', 'expired', 'notSent'],
  ['answered', 'expired', 'expired', 'notSent'],
]

function buildMatrix(days: (AdherenceDay | null)[]): MatrixState[][] {
  const matrix: MatrixState[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 14 }, () => 'notSent' as MatrixState),
  )

  days.slice(0, 4).forEach((stats, dayIndex) => {
    if (!stats) return
    for (let request = 0; request < 4; request += 1) {
      if (request < stats.answered) {
        matrix[request][dayIndex] = 'answered'
      } else if (request < stats.sent) {
        matrix[request][dayIndex] = dayIndex === 3 ? 'pending' : 'expired'
      }
    }
  })

  return matrix
}

function padMatrix(matrix: MatrixState[][]): MatrixState[][] {
  return matrix.map((row) => {
    const cells = row.slice(0, 14)
    while (cells.length < 14) cells.push('notSent')
    return cells
  })
}

function buildFree(days: (AdherenceDay | null)[], isP07: boolean): (number | null)[] {
  const free: (number | null)[] = Array.from({ length: 14 }, () => null)
  days.slice(0, 4).forEach((stats, dayIndex) => {
    if (!stats) return
    if (isP07) {
      free[dayIndex] = dayIndex === 0 ? 1 : 0
    } else {
      free[dayIndex] = 0
    }
  })
  return free
}

export function getParticipantDetail(id: string): ParticipantDetail | undefined {
  const participant = findParticipant(id)
  if (!participant) return undefined

  const isP07 = participant.id === 'P-07'
  const totals = participant.days.reduce<{ answered: number; sent: number }>(
    (acc, stats) => {
      if (!stats) return acc
      return { answered: acc.answered + stats.answered, sent: acc.sent + stats.sent }
    },
    { answered: 0, sent: 0 },
  )
  const percent = totals.sent === 0 ? 0 : Math.round((totals.answered / totals.sent) * 100)
  const free = buildFree(participant.days, isP07)
  const freeCount = free.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const index = Number(participant.id.replace('P-', '')) - 1
  const identity = identityNames[index % identityNames.length]

  return {
    participant,
    consentLabel: isP07
      ? '6 out. às 11:02 · versão 2'
      : participant.consent === '–'
        ? '–'
        : `${participant.consent} · versão 2`,
    totals: { ...totals, percent },
    freeCount,
    matrix: isP07 ? padMatrix(p07Matrix) : buildMatrix(participant.days),
    free,
    gap:
      participant.id === 'P-07' || participant.id === 'P-19'
        ? { last: participant.lastEntry, sentToday: 2 }
        : null,
    identity: { name: identity[0], email: identity[1] },
    weekday: isP07 ? ['09:00 às 11:00', '18:30 às 21:30'] : [participant.hours],
    weekend: '10:00 às 22:00',
    phoneLast: isP07 ? 'Ligado a 6 out. às 11:02' : `Ligado a ${participant.consent}`,
  }
}

export interface WaitingEntry {
  id: string
  label: string
  when: string
}

export const waitingEntries: WaitingEntry[] = [
  { id: 'wait-1', label: 'Pessoa 1', when: 'a 8 out., às 17:42' },
  { id: 'wait-2', label: 'Pessoa 2', when: 'hoje, às 11:08' },
]

export interface StudyCode {
  id: string
  name: string
  code: string
  state: 'active' | 'off'
  uses: string
  usesNote: string
  until: string
  created: string
  approval: string
  approvalNote: string
  limit: string
  limitNote: string
  hourly: string
  account: string
  qrSeed: number
}

export const waitingCode = 'JE4K-7QTX'

export const studyCodes: StudyCode[] = [
  {
    id: 'code-jardim',
    name: 'Cartaz no quiosque do jardim',
    code: 'JE4K-7QTX',
    state: 'active',
    uses: '2 à espera',
    usesNote: '0 aprovadas, 0 recusadas',
    until: '12 out. 2026',
    created: 'criado a 8 out., 10:05',
    approval: 'Ligada',
    approvalNote: 'A equipa decide cada entrada',
    limit: '10 entradas',
    limitNote: 'definido pela Inês. As recusadas não contam',
    hourly: 'Desligado',
    account: 'Não',
    qrSeed: 7,
  },
  {
    id: 'code-junta',
    name: 'Folheto da junta de freguesia',
    code: 'JF2M-8RWC',
    state: 'off',
    uses: '0 pessoas',
    usesNote: 'desligado a 7 out.',
    until: '31 out. 2026',
    created: 'criado a 5 out.',
    approval: 'Desligada',
    approvalNote: 'Entrada automática, sem aprovação',
    limit: 'Sem limite',
    limitNote: 'as recusadas não contam',
    hourly: 'Desligado',
    account: 'Não',
    qrSeed: 19,
  },
]

export const newStudyCodeDefaults = {
  name: 'Cartaz no portão da Rua da Estrela',
  end: '16 out. 2026',
  limitOn: false,
  hourlyOn: false,
  approvalOn: true,
  accountOn: false,
}

export type PosterStyle = 'info' | 'solid' | 'circle' | 'band' | 'minimal'

export type PosterContent = 'code' | 'qr' | 'both'

export const addParticipantDefaults = {
  pseudonym: 'P-25',
  name: 'Marta Campos',
  email: 'marta.campos@example.pt',
  language: 'Português',
  code: 'K7QM-2RXP-9DHT',
  validUntil: '16 out.',
  qrSeed: 25,
}

export const inviteCodeRounds = ['K7QM-2RXP-9DHT', 'RG4P-8TVN-2WCA', 'H9XD-5MJK-7QBE']

export interface RecruitOption {
  id: string
  label: string
  selected: boolean
}

export const recruitCounties: RecruitOption[] = [
  { id: 'lisboa', label: 'Lisboa', selected: true },
  { id: 'amadora', label: 'Amadora', selected: true },
  { id: 'odivelas', label: 'Odivelas', selected: true },
]

export const recruitSituations: RecruitOption[] = [
  { id: 'student', label: 'Estudante', selected: true },
  { id: 'employee', label: 'Trabalhador por conta de outrem', selected: false },
  { id: 'self', label: 'Trabalhador por conta própria', selected: false },
  { id: 'unemployed', label: 'Desempregado', selected: false },
  { id: 'retired', label: 'Reformado', selected: false },
  { id: 'other', label: 'Outra', selected: false },
]

export const recruitAges: RecruitOption[] = [
  { id: '18-24', label: '18-24', selected: true },
  { id: '25-34', label: '25-34', selected: true },
  { id: '35-44', label: '35-44', selected: false },
  { id: '45-54', label: '45-54', selected: false },
  { id: '55-64', label: '55-64', selected: false },
  { id: '65+', label: '65 ou mais', selected: false },
]

export const recruitOtherFilters = ['Género', 'Como se desloca', 'Línguas', 'Freguesia']
