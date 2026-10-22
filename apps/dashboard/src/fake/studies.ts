export type StudyStatus = 'ongoing' | 'draft' | 'finished'
export type StudyRole = 'owner' | 'collaborator'
export type StudyMetricKind = 'participants' | 'entries' | 'adherence' | 'adherenceFinal'

export type StudyMetric = {
  kind: StudyMetricKind
  value: string
  note: string
}

export type StudySummary = {
  id: string
  title: string
  description: string
  status: StudyStatus
  role: StudyRole
  period: string
  schedule: string
  metrics: StudyMetric[]
}

export const demoStudyId = 'jardim-da-estrela'

export const myStudies: StudySummary[] = [
  {
    id: demoStudyId,
    title: 'Viver o Jardim da Estrela',
    description:
      'Como é que os moradores usam o Jardim da Estrela ao longo do dia, durante duas semanas.',
    status: 'ongoing',
    role: 'owner',
    period: '6 a 19 out. 2026 · dia 4 de 14',
    schedule: 'Calendário variado · 7 pontos precisam de atenção',
    metrics: [
      { kind: 'participants', value: '24', note: '22 ativos' },
      { kind: 'entries', value: '268', note: '+31 hoje' },
      { kind: 'adherence', value: '71 %', note: '29 de 41 pedidos' },
    ],
  },
  {
    id: 'trajetos-casa-faculdade',
    title: 'Trajetos casa-faculdade',
    description: 'Rascunho de Rita Ferraz. Ainda sem participantes convidados.',
    status: 'draft',
    role: 'collaborator',
    period: '2 a 15 nov. 2026 (previsto)',
    schedule: 'Calendário fixo · proprietária: Rita Ferraz',
    metrics: [
      { kind: 'participants', value: '0', note: '12 previstos' },
      { kind: 'entries', value: '–', note: 'ainda não começou' },
      { kind: 'adherence', value: '–', note: 'ainda não começou' },
    ],
  },
  {
    id: 'pequenos-almocos-em-casa',
    title: 'Pequenos-almoços em casa',
    description: 'Estudo terminado. Os dados continuam disponíveis para consulta e exportação.',
    status: 'finished',
    role: 'collaborator',
    period: '7 a 20 set. 2026',
    schedule: 'Calendário equilibrado · proprietária: Rita Ferraz',
    metrics: [
      { kind: 'participants', value: '18', note: 'todos terminaram' },
      { kind: 'entries', value: '1 512', note: 'no total' },
      { kind: 'adherenceFinal', value: '81 %', note: 'nos 14 dias' },
    ],
  },
]

/* New study */

export type CalendarStyleId = 'fixed' | 'balanced' | 'varied'

export type CalendarStyle = {
  id: CalendarStyleId
  dots: { x: number; y: number }[]
}

export const calendarStyles: CalendarStyle[] = [
  {
    id: 'fixed',
    dots: [22, 60, 98].flatMap((x) => [9, 20, 31].map((y) => ({ x, y }))),
  },
  {
    id: 'balanced',
    dots: [
      ...[22, 60, 98].map((x) => ({ x, y: 9 })),
      ...[28, 66, 94].map((x) => ({ x, y: 20 })),
    ],
  },
  {
    id: 'varied',
    dots: [
      ...[22, 60, 98].map((x) => ({ x, y: 9 })),
      ...[40, 84, 112].map((x) => ({ x, y: 20 })),
      ...[16, 52, 104].map((x) => ({ x, y: 31 })),
    ],
  },
]

export const newStudyDefaults = {
  title: 'Mercados de bairro',
  description:
    'Como é que as pessoas usam os mercados de bairro de Lisboa ao longo da semana, durante duas semanas.',
  start: '9 nov. 2026',
  end: '22 nov. 2026',
  timezone: 'Lisboa (Europe/Lisbon)',
  maxPerDay: 3,
  maxPerSlot: 2,
  poolInvite: true,
}

export const timezones = ['Lisboa (Europe/Lisbon)']

export type TeamMember = {
  initials: string
  name: string
  email: string
}

export const studyOwner: TeamMember = {
  initials: 'IM',
  name: 'Inês Marques',
  email: 'ines.marques@unidcom.pt',
}

/* Study overview */

export type AttentionTone = 'danger' | 'warning' | 'neutral'
export type AttentionIcon = 'alert' | 'users' | 'calendar' | 'user' | 'mail' | 'ban'
export type AttentionActionKind = 'retry' | 'review' | 'plan' | 'participant' | 'invite'

export type AttentionItem = {
  id: string
  icon: AttentionIcon
  tone: AttentionTone
  title: string
  detail: string
  action?: {
    kind: AttentionActionKind
    type: 'button' | 'link'
    to?: string
  }
}

export type TrendPoint = {
  label: string
  value: string
  height: number
  current: boolean
}

export type FunnelStep = {
  label: 'planned' | 'sent' | 'seen' | 'opened' | 'answered'
  value: number
  note: string
  width: number
  color: string
}

export type AdherenceCell = { answered: number; sent: number }

export type AdherenceRow = {
  alias: string
  note: string
  cells: (AdherenceCell | null)[]
  last: string
  warn: boolean
}

export type EntryKind = 'photo' | 'text' | 'audio'

export type FeedItem = {
  alias: string
  type: string
  activity: string
  recorded: string
  received: string
  late?: boolean
  kind: EntryKind
  sky?: string
  ground?: string
  tree?: string
}

export type HourDatum = { hour: number; sent: number; planned: number }

export type EntryTypeSlice = { name: string; value: number; color: string }

export type ActivitySlice = {
  code: string
  name: string
  value: number
  requested: number
  free: number
  note: string
}

export const overviewStudy = {
  id: demoStudyId,
  title: 'Viver o Jardim da Estrela',
  day: 4,
  totalDays: 14,
  dateRange: '6 a 19 out. 2026',
  participantCount: 24,
  participantsActive: 22,
  dateLabel: 'sex., 9 out.',
  currentTime: '14:32',
  adherence: { percent: '71 %', answered: 29, sent: 41 },
  trend: [
    { label: 'Dia 1', value: '78 %', height: 47, current: false },
    { label: 'Dia 2', value: '74 %', height: 44, current: false },
    { label: 'Dia 3', value: '69 %', height: 41, current: false },
    { label: 'Hoje', value: '71 %', height: 43, current: true },
  ] satisfies TrendPoint[],
  entries: { total: '268', today: 31, answered: 29, free: 2 },
  active: { value: 22, total: 24, invites: 1, declined: 1 },
  effort: { value: '8 min', unit: 'por dia', note: 'Por participante: 2 × 3 min + 1 min + 1 min' },
  attention: [
    {
      id: 'media-failed',
      icon: 'alert',
      tone: 'danger',
      title: '1 ficheiro não foi processado',
      detail: 'P-09 · vídeo de 8 out., 19:12. Não foi possível converter o vídeo.',
      action: { kind: 'retry', type: 'button' },
    },
    {
      id: 'approvals',
      icon: 'users',
      tone: 'warning',
      title: '2 pessoas à espera de aprovação',
      detail:
        'Entraram pelo código «Cartaz no quiosque do jardim», a 8 out. às 17:42 e hoje às 11:08. Ainda não são participantes.',
      action: { kind: 'review', type: 'link', to: 'participantes' },
    },
    {
      id: 'unplanned',
      icon: 'calendar',
      tone: 'warning',
      title: '3 pedidos de hoje ficaram por planear',
      detail:
        '2 não cabem com o intervalo mínimo (P-04, P-11) e 1 caiu num intervalo de 15 minutos já cheio (P-17).',
      action: { kind: 'plan', type: 'link', to: 'plano' },
    },
    {
      id: 'p07',
      icon: 'user',
      tone: 'warning',
      title: 'P-07 sem registos há 2 dias',
      detail: 'Último registo a 7 out., 18:40.',
      action: { kind: 'participant', type: 'link', to: 'participantes' },
    },
    {
      id: 'p19',
      icon: 'user',
      tone: 'warning',
      title: 'P-19 sem registos há 2 dias',
      detail: 'Último registo a 7 out., 13:05.',
      action: { kind: 'participant', type: 'link', to: 'participantes' },
    },
    {
      id: 'p23',
      icon: 'mail',
      tone: 'neutral',
      title: 'O convite de P-23 expira a 14 out.',
      detail: 'Código emitido a 7 out. e ainda não usado.',
      action: { kind: 'invite', type: 'link', to: 'participantes' },
    },
    {
      id: 'p24',
      icon: 'ban',
      tone: 'neutral',
      title: 'P-24 recusou participar',
      detail: 'Não conta nos participantes ativos.',
    },
  ] satisfies AttentionItem[],
  funnel: [
    { label: 'planned', value: 85, note: '85 de 88 pedidos previstos', width: 100, color: '#C9D9FB' },
    { label: 'sent', value: 41, note: '48 % dos planeados', width: 48.2, color: '#9DB4F7' },
    { label: 'seen', value: 39, note: '95 % dos enviados', width: 45.9, color: '#6C8CF0' },
    { label: 'opened', value: 34, note: '83 % dos enviados', width: 40, color: '#4A72EC' },
    { label: 'answered', value: 29, note: '71 % dos enviados', width: 34.1, color: '#1E3FB0' },
  ] satisfies FunnelStep[],
  outcomes: { answered: 29, open: 9, expired: 3 },
  pending: { sent: 41, pending: 44, planned: 85, unplanned: 3, expected: 88 },
  dayHeads: [
    { label: 'Dia 1', sub: '6 out.' },
    { label: 'Dia 2', sub: '7 out.' },
    { label: 'Dia 3', sub: '8 out.' },
    { label: 'Dia 4 · hoje', sub: 'parcial' },
  ],
  totals: ['78 %', '74 %', '69 %', '71 %'],
  adherenceRows: [
    {
      alias: 'P-07',
      note: 'sem registos há 2 dias',
      cells: [
        { answered: 3, sent: 4 },
        { answered: 2, sent: 4 },
        { answered: 0, sent: 4 },
        { answered: 0, sent: 2 },
      ],
      last: '7 out., 18:40',
      warn: true,
    },
    {
      alias: 'P-19',
      note: 'sem registos há 2 dias',
      cells: [
        { answered: 2, sent: 4 },
        { answered: 1, sent: 4 },
        { answered: 0, sent: 4 },
        { answered: 0, sent: 2 },
      ],
      last: '7 out., 13:05',
      warn: true,
    },
    {
      alias: 'P-09',
      note: '1 ficheiro falhou',
      cells: [
        { answered: 3, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 2, sent: 4 },
        { answered: 2, sent: 2 },
      ],
      last: 'há 1 h 27 min',
      warn: false,
    },
    {
      alias: 'P-17',
      note: '1 pedido por planear',
      cells: [
        { answered: 3, sent: 4 },
        { answered: 4, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 1, sent: 2 },
      ],
      last: 'há 51 min',
      warn: false,
    },
    {
      alias: 'P-04',
      note: 'só 16:00 a 22:00',
      cells: [
        { answered: 2, sent: 3 },
        { answered: 3, sent: 3 },
        { answered: 2, sent: 3 },
        null,
      ],
      last: '8 out., 21:12',
      warn: false,
    },
    {
      alias: 'P-11',
      note: 'só 16:00 a 22:00',
      cells: [
        { answered: 3, sent: 3 },
        { answered: 2, sent: 3 },
        { answered: 3, sent: 3 },
        null,
      ],
      last: '8 out., 20:48',
      warn: false,
    },
    {
      alias: 'P-01',
      note: '',
      cells: [
        { answered: 4, sent: 4 },
        { answered: 4, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 2, sent: 2 },
      ],
      last: 'há 21 min',
      warn: false,
    },
    {
      alias: 'P-03',
      note: '',
      cells: [
        { answered: 3, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 4, sent: 4 },
        { answered: 2, sent: 3 },
      ],
      last: 'há 1 h 44 min',
      warn: false,
    },
    {
      alias: 'P-12',
      note: '',
      cells: [
        { answered: 3, sent: 4 },
        { answered: 4, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 2, sent: 3 },
      ],
      last: 'há 2 h 27 min',
      warn: false,
    },
    {
      alias: 'P-14',
      note: 'telemóvel novo a 8 out.',
      cells: [
        { answered: 4, sent: 4 },
        { answered: 3, sent: 4 },
        { answered: 2, sent: 4 },
        { answered: 2, sent: 3 },
      ],
      last: 'há 30 min',
      warn: false,
    },
    {
      alias: 'P-23',
      note: 'convite por usar',
      cells: [null, null, null, null],
      last: '–',
      warn: false,
    },
    {
      alias: 'P-24',
      note: 'recusou participar',
      cells: [null, null, null, null],
      last: '–',
      warn: false,
    },
  ] satisfies AdherenceRow[],
  feed: [
    {
      alias: 'P-21',
      type: 'texto',
      activity: 'O que o trouxe ao jardim?',
      recorded: '14:27',
      received: '14:27',
      kind: 'text',
    },
    {
      alias: 'P-08',
      type: 'foto',
      activity: 'Um momento no jardim',
      recorded: '14:19',
      received: '14:19',
      kind: 'photo',
      sky: '#CFE3EA',
      ground: '#7FA37E',
      tree: '#3F7A55',
    },
    {
      alias: 'P-01',
      type: 'foto',
      activity: 'Um momento no jardim',
      recorded: '14:11',
      received: '14:11',
      kind: 'photo',
      sky: '#E6E1CF',
      ground: '#8FA67A',
      tree: '#2E6B4F',
    },
    {
      alias: 'P-16',
      type: 'áudio 0:38',
      activity: 'O que o trouxe ao jardim?',
      recorded: '14:06',
      received: '14:06',
      kind: 'audio',
    },
    {
      alias: 'P-14',
      type: 'foto',
      activity: 'Um momento no jardim',
      recorded: '14:02',
      received: '14:03',
      kind: 'photo',
      sky: '#D8E4D2',
      ground: '#9DB58A',
      tree: '#4D8A63',
    },
    {
      alias: 'P-22',
      type: 'foto',
      activity: 'Um momento no jardim',
      recorded: '11:49',
      received: '14:02',
      late: true,
      kind: 'photo',
      sky: '#EBD9BC',
      ground: '#86A27C',
      tree: '#3F7A55',
    },
  ] satisfies FeedItem[],
  hours: [
    { hour: 8, sent: 3, planned: 0 },
    { hour: 9, sent: 6, planned: 0 },
    { hour: 10, sent: 6, planned: 0 },
    { hour: 11, sent: 5, planned: 0 },
    { hour: 12, sent: 7, planned: 0 },
    { hour: 13, sent: 8, planned: 0 },
    { hour: 14, sent: 6, planned: 4 },
    { hour: 15, sent: 0, planned: 6 },
    { hour: 16, sent: 0, planned: 6 },
    { hour: 17, sent: 0, planned: 5 },
    { hour: 18, sent: 0, planned: 5 },
    { hour: 19, sent: 0, planned: 5 },
    { hour: 20, sent: 0, planned: 7 },
    { hour: 21, sent: 0, planned: 6 },
  ] satisfies HourDatum[],
  types: [
    { name: 'Fotos', value: 121, color: '#1E3FB0' },
    { name: 'Textos', value: 64, color: '#6C8CF0' },
    { name: 'Áudios', value: 31, color: '#FFB020' },
    { name: 'Vídeos', value: 12, color: '#9A5700' },
    { name: 'Escalas', value: 40, color: '#8A93A8' },
  ] satisfies EntryTypeSlice[],
  activities: [
    {
      code: 'A1',
      name: 'Um momento no jardim',
      value: 181,
      requested: 132,
      free: 49,
      note: '121 fotos, 12 vídeos e 48 textos · 49 livres',
    },
    {
      code: 'A2',
      name: 'O que o trouxe ao jardim?',
      value: 47,
      requested: 47,
      free: 0,
      note: '31 áudios e 16 textos',
    },
    {
      code: 'A3',
      name: 'Como se sente agora?',
      value: 40,
      requested: 40,
      free: 0,
      note: '40 escalas de 1 a 7',
    },
  ] satisfies ActivitySlice[],
  delayed: 38,
  tagged: 46,
}

/* Plan */

export type ActivityCode = 'A1' | 'A2' | 'A3'

export const planActivities: { code: ActivityCode; name: string; color: string }[] = [
  { code: 'A1', name: 'Um momento no jardim', color: '#2F5BEA' },
  { code: 'A2', name: 'O que o trouxe ao jardim?', color: '#0E7C66' },
  { code: 'A3', name: 'Como se sente agora?', color: '#B96A00' },
]

export type PlanReasonId = 'outsideHours' | 'interval' | 'dailyMax' | 'slotFull' | 'timeout'

export const planReasonOrder: PlanReasonId[] = [
  'outsideHours',
  'interval',
  'dailyMax',
  'slotFull',
  'timeout',
]

export type PlanRequestStatus = 'responded' | 'sent' | 'expired' | 'planned'

export type PlanRequest = {
  activity: ActivityCode
  minutes: number
  status: PlanRequestStatus
}

export type PlanUnplannedMarker = {
  activity: ActivityCode
  reason: PlanReasonId
}

export type PlanParticipant = {
  alias: string
  windowStart: number
  windowEnd: number
  requests: PlanRequest[]
  unplanned?: PlanUnplannedMarker
}

export type PlanUnplannedItem = {
  id: string
  alias: string
  activity: ActivityCode
  reason: PlanReasonId
  detail: string
}

export type PlanDay = {
  key: 'today' | 'tomorrow'
  dateLabel: string
  planned: number
  expected: number
  unplanned: number
  calculatedAt: string
  duration: string
  maxPerDay: number
  maxPerSlot: number
  styleName: string
  intervalMin: number
  participantsActive: number
  unplannedItems: PlanUnplannedItem[]
  reasonCounts: Record<PlanReasonId, number>
  participants: PlanParticipant[]
  intervalSent: number[]
  intervalPlanned: number[]
  nowPercent: number | null
  nowLabel: string | null
  sentTotal: number
  pendingTotal: number
}

const START = 8 * 60
const END = 22 * 60 + 30
export const planAxisStart = START
export const planAxisEnd = END
export const planSlotCount = (END - START) / 15

const baseParticipants: PlanParticipant[] = [
  {
    alias: 'P-01',
    windowStart: 9 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 11 * 60 + 45, status: 'responded' },
      { activity: 'A1', minutes: 14 * 60 + 10, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60 + 15, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 15, status: 'planned' },
    ],
  },
  {
    alias: 'P-02',
    windowStart: 8 * 60 + 30,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 10 * 60, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 30, status: 'expired' },
      { activity: 'A2', minutes: 15 * 60, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 45, status: 'planned' },
    ],
  },
  {
    alias: 'P-03',
    windowStart: 9 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 15, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 30, status: 'responded' },
      { activity: 'A2', minutes: 14 * 60 + 30, status: 'sent' },
      { activity: 'A3', minutes: 21 * 60, status: 'planned' },
    ],
  },
  {
    alias: 'P-04',
    windowStart: 16 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 16 * 60, status: 'planned' },
      { activity: 'A1', minutes: 18 * 60, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 15, status: 'planned' },
    ],
    unplanned: { activity: 'A2', reason: 'interval' },
  },
  {
    alias: 'P-05',
    windowStart: 9 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 15, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60 + 45, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60, status: 'planned' },
    ],
  },
  {
    alias: 'P-06',
    windowStart: 10 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 10 * 60 + 15, status: 'sent' },
      { activity: 'A1', minutes: 13 * 60 + 45, status: 'responded' },
      { activity: 'A2', minutes: 17 * 60, status: 'planned' },
      { activity: 'A3', minutes: 21 * 60 + 15, status: 'planned' },
    ],
  },
  {
    alias: 'P-07',
    windowStart: 10 * 60,
    windowEnd: 21 * 60,
    requests: [
      { activity: 'A1', minutes: 10 * 60 + 45, status: 'expired' },
      { activity: 'A1', minutes: 13 * 60 + 15, status: 'sent' },
      { activity: 'A2', minutes: 16 * 60, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 30, status: 'planned' },
    ],
  },
  {
    alias: 'P-08',
    windowStart: 8 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 8 * 60 + 45, status: 'responded' },
      { activity: 'A1', minutes: 11 * 60 + 15, status: 'responded' },
      { activity: 'A2', minutes: 15 * 60 + 45, status: 'sent' },
      { activity: 'A3', minutes: 19 * 60 + 45, status: 'planned' },
    ],
  },
  {
    alias: 'P-09',
    windowStart: 9 * 60 + 30,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 45, status: 'responded' },
      { activity: 'A1', minutes: 13 * 60, status: 'responded' },
      { activity: 'A2', minutes: 15 * 60 + 30, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60, status: 'planned' },
    ],
  },
  {
    alias: 'P-10',
    windowStart: 9 * 60 + 30,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 30, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 45, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60 + 30, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 45, status: 'planned' },
    ],
  },
  {
    alias: 'P-11',
    windowStart: 16 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 16 * 60 + 15, status: 'planned' },
      { activity: 'A1', minutes: 18 * 60 + 15, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 30, status: 'planned' },
    ],
    unplanned: { activity: 'A2', reason: 'interval' },
  },
  {
    alias: 'P-12',
    windowStart: 9 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 45, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60, status: 'responded' },
      { activity: 'A2', minutes: 14 * 60 + 15, status: 'sent' },
      { activity: 'A3', minutes: 20 * 60 + 15, status: 'planned' },
    ],
  },
  {
    alias: 'P-13',
    windowStart: 9 * 60,
    windowEnd: 21 * 60,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 15, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60, status: 'sent' },
      { activity: 'A2', minutes: 15 * 60 + 15, status: 'planned' },
      { activity: 'A3', minutes: 19 * 60 + 30, status: 'planned' },
    ],
  },
  {
    alias: 'P-14',
    windowStart: 9 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 30, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60, status: 'responded' },
      { activity: 'A2', minutes: 14 * 60 + 15, status: 'sent' },
      { activity: 'A3', minutes: 20 * 60, status: 'planned' },
    ],
  },
  {
    alias: 'P-15',
    windowStart: 10 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 10 * 60 + 30, status: 'responded' },
      { activity: 'A1', minutes: 13 * 60, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60, status: 'planned' },
    ],
  },
  {
    alias: 'P-16',
    windowStart: 8 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 8 * 60 + 15, status: 'sent' },
      { activity: 'A1', minutes: 11 * 60, status: 'responded' },
      { activity: 'A2', minutes: 14 * 60 + 45, status: 'sent' },
      { activity: 'A3', minutes: 19 * 60 + 15, status: 'planned' },
    ],
  },
  {
    alias: 'P-17',
    windowStart: 8 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 8 * 60 + 30, status: 'sent' },
      { activity: 'A2', minutes: 12 * 60 + 30, status: 'responded' },
      { activity: 'A3', minutes: 20 * 60 + 30, status: 'planned' },
    ],
    unplanned: { activity: 'A1', reason: 'slotFull' },
  },
  {
    alias: 'P-18',
    windowStart: 9 * 60 + 30,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 45, status: 'responded' },
      { activity: 'A1', minutes: 13 * 60 + 15, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60 + 45, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 30, status: 'planned' },
    ],
  },
  {
    alias: 'P-19',
    windowStart: 9 * 60 + 30,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 15, status: 'expired' },
      { activity: 'A1', minutes: 13 * 60, status: 'sent' },
      { activity: 'A2', minutes: 15 * 60 + 30, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 30, status: 'planned' },
    ],
  },
  {
    alias: 'P-20',
    windowStart: 9 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 30, status: 'responded' },
      { activity: 'A1', minutes: 11 * 60 + 45, status: 'responded' },
      { activity: 'A2', minutes: 14 * 60 + 15, status: 'sent' },
      { activity: 'A3', minutes: 20 * 60 + 15, status: 'planned' },
    ],
  },
  {
    alias: 'P-21',
    windowStart: 9 * 60,
    windowEnd: 22 * 60,
    requests: [
      { activity: 'A1', minutes: 9 * 60 + 30, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 30, status: 'responded' },
      { activity: 'A2', minutes: 15 * 60 + 30, status: 'planned' },
      { activity: 'A3', minutes: 19 * 60 + 45, status: 'planned' },
    ],
  },
  {
    alias: 'P-22',
    windowStart: 10 * 60,
    windowEnd: 21 * 60 + 30,
    requests: [
      { activity: 'A1', minutes: 10 * 60 + 15, status: 'responded' },
      { activity: 'A1', minutes: 12 * 60 + 45, status: 'responded' },
      { activity: 'A2', minutes: 16 * 60 + 15, status: 'planned' },
      { activity: 'A3', minutes: 20 * 60 + 15, status: 'planned' },
    ],
  },
]

function spreadRequests(total: number, from: number, to: number): number[] {
  const slots = Array.from({ length: planSlotCount }, () => 0)
  let remaining = total
  for (let index = from; index < to && remaining > 0; index += 2) {
    slots[index] = Math.min(3, remaining)
    remaining -= slots[index]
  }
  for (let index = from; index < to && remaining > 0; index += 1) {
    const free = 3 - slots[index]
    if (free > 0) {
      const add = Math.min(free, remaining)
      slots[index] += add
      remaining -= add
    }
  }
  return slots
}

const nowPercent = 45.05747126436781

const todayUnplanned: PlanUnplannedItem[] = [
  {
    id: 'P-04-A2',
    alias: 'P-04',
    activity: 'A2',
    reason: 'interval',
    detail:
      'O participante só indicou as 16:00 às 22:00. A atividade A2 só pede até às 20:00 e, dentro dessas horas, teria de ficar a 120 minutos dos pedidos de A1 (16:00 e 18:00) e de A3 (20:15).',
  },
  {
    id: 'P-11-A2',
    alias: 'P-11',
    activity: 'A2',
    reason: 'interval',
    detail:
      'Mesmo caso: indicou só as 16:00 às 22:00, por isso A2 (até às 20:00) não consegue manter os 120 minutos de A1 e A3.',
  },
  {
    id: 'P-17-A1',
    alias: 'P-17',
    activity: 'A1',
    reason: 'slotFull',
    detail:
      'Das 13:00 às 13:15 já havia 3 pedidos de outros participantes, o máximo definido. Não havia outro intervalo livre que respeitasse os 120 minutos.',
  },
]

const tomorrowUnplannedAliases = new Set(['P-06', 'P-13', 'P-21'])

function buildTomorrowParticipants(): PlanParticipant[] {
  return baseParticipants.map((participant) => {
    if (!tomorrowUnplannedAliases.has(participant.alias)) {
      return {
        ...participant,
        requests: participant.requests.map((request) => ({ ...request, status: 'planned' })),
      }
    }

    return {
      ...participant,
      requests: participant.requests
        .slice(0, 3)
        .map((request) => ({ ...request, status: 'planned' })),
      unplanned:
        participant.alias === 'P-06'
          ? { activity: 'A2', reason: 'interval' }
          : participant.alias === 'P-13'
            ? { activity: 'A2', reason: 'slotFull' }
            : { activity: 'A3', reason: 'dailyMax' },
    }
  })
}

export const planDays: Record<'today' | 'tomorrow', PlanDay> = {
  today: {
    key: 'today',
    dateLabel: 'sex., 9 out. 2026',
    planned: 85,
    expected: 88,
    unplanned: 3,
    calculatedAt: '03:00',
    duration: '1,8 segundos',
    maxPerDay: 4,
    maxPerSlot: 3,
    styleName: 'Variado',
    intervalMin: 120,
    participantsActive: 22,
    unplannedItems: todayUnplanned,
    reasonCounts: { outsideHours: 0, interval: 2, dailyMax: 0, slotFull: 1, timeout: 0 },
    participants: baseParticipants,
    intervalSent: spreadRequests(41, 0, 26),
    intervalPlanned: spreadRequests(44, 26, planSlotCount),
    nowPercent,
    nowLabel: '14:32',
    sentTotal: 41,
    pendingTotal: 44,
  },
  tomorrow: {
    key: 'tomorrow',
    dateLabel: 'sáb., 10 out. 2026',
    planned: 85,
    expected: 88,
    unplanned: 3,
    calculatedAt: '03:00',
    duration: '1,6 segundos',
    maxPerDay: 4,
    maxPerSlot: 3,
    styleName: 'Variado',
    intervalMin: 120,
    participantsActive: 22,
    unplannedItems: [
      {
        id: 'P-06-A2',
        alias: 'P-06',
        activity: 'A2',
        reason: 'interval',
        detail:
          'A janela de A2 termina às 20:00 e o participante só indicou horas a partir das 10:00. Com os pedidos de A1 já planeados, não sobram 120 minutos para A2.',
      },
      {
        id: 'P-13-A2',
        alias: 'P-13',
        activity: 'A2',
        reason: 'slotFull',
        detail:
          'O único intervalo de 15 minutos livre para A2 já tinha 3 pedidos de outros participantes, o máximo definido. Os 120 minutos entre pedidos não deixavam outra opção.',
      },
      {
        id: 'P-21-A3',
        alias: 'P-21',
        activity: 'A3',
        reason: 'dailyMax',
        detail:
          'A2 ficou marcado para o mesmo dia e o participante já tinha 4 pedidos planeados, o máximo por participante e por dia. A3 fica para o dia seguinte.',
      },
    ],
    reasonCounts: { outsideHours: 0, interval: 1, dailyMax: 1, slotFull: 1, timeout: 0 },
    participants: buildTomorrowParticipants(),
    intervalSent: Array.from({ length: planSlotCount }, () => 0),
    intervalPlanned: spreadRequests(85, 0, planSlotCount),
    nowPercent: null,
    nowLabel: null,
    sentTotal: 0,
    pendingTotal: 85,
  },
}

export const planPeakAllAtOnce = 22
