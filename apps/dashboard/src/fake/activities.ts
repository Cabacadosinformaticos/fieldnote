export const demoStudyId = 'jardim-da-estrela'
export const demoStudyTitle = 'Viver o Jardim da Estrela'

export type ActivityTypeId = 'photo' | 'text' | 'video' | 'audio' | 'scale'
export type ActivityTone = 'blue' | 'teal' | 'amber'
export type ScaleKind = 'number' | 'faces' | 'text' | 'bar'

export type ActivitySummary = {
  id: string
  code: string
  tone: ActivityTone
  title: string
  description: string
  types: ActivityTypeId[]
  scale: { kind: ScaleKind; points: number } | null
  windowStart: string
  windowEnd: string
  requestsPerDay: number
  minGapMinutes: number
  effortMinutes: number
  locationRequested: boolean
  freeEntries: { enabled: boolean; maxPerDay: number; countSoFar: number }
}

export const activities: ActivitySummary[] = [
  {
    id: 'a1',
    code: 'A1',
    tone: 'blue',
    title: 'Um momento no jardim',
    description:
      'Fotografe ou descreva o sítio onde está agora no jardim e o que está a fazer. Evite fotografar pessoas que não estão no estudo, documentos e números de porta.',
    types: ['photo', 'text', 'video'],
    scale: null,
    windowStart: '08:00',
    windowEnd: '22:00',
    requestsPerDay: 2,
    minGapMinutes: 120,
    effortMinutes: 3,
    locationRequested: true,
    freeEntries: { enabled: true, maxPerDay: 2, countSoFar: 49 },
  },
  {
    id: 'a2',
    code: 'A2',
    tone: 'teal',
    title: 'O que o trouxe ao jardim?',
    description:
      'Conte em poucas palavras o que o trouxe hoje ao jardim. Pode gravar até 1 minuto de áudio ou escrever.',
    types: ['audio', 'text'],
    scale: null,
    windowStart: '12:00',
    windowEnd: '20:00',
    requestsPerDay: 1,
    minGapMinutes: 120,
    effortMinutes: 1,
    locationRequested: false,
    freeEntries: { enabled: false, maxPerDay: 0, countSoFar: 0 },
  },
  {
    id: 'a3',
    code: 'A3',
    tone: 'amber',
    title: 'Como se sente agora?',
    description: 'De 1 (muito mal) a 7 (muito bem), como se sente neste momento?',
    types: ['scale'],
    scale: { kind: 'number', points: 7 },
    windowStart: '20:00',
    windowEnd: '22:30',
    requestsPerDay: 1,
    minGapMinutes: 120,
    effortMinutes: 1,
    locationRequested: false,
    freeEntries: { enabled: false, maxPerDay: 0, countSoFar: 0 },
  },
]

export const scaleKinds: ScaleKind[] = ['number', 'faces', 'text', 'bar']
export const scalePointChoices = [3, 5, 7, 10] as const

export const allowedScalePoints: Record<ScaleKind, readonly number[]> = {
  number: [3, 5, 7, 10],
  faces: [3, 5],
  text: [3, 5, 7],
  bar: [],
}

export function activityToneClass(tone: ActivityTone): string {
  return `ac-tone-${tone}`
}

export type ActivityDraft = {
  id: string | null
  code: string
  title: string
  instruction: string
  types: ActivityTypeId[]
  scale: { kind: ScaleKind; points: number; lowLabel: string; highLabel: string; midLabel: string }
  effortMinutes: number
  locationRequested: boolean
  freeEntriesEnabled: boolean
  freeEntriesPerDay: number
  windowStart: string
  windowEnd: string
  requestsPerDay: number
  minGapMinutes: number
}

// The edit mockup shows A1 with the scale editor already open, while the list mockup
// only lists the capture types. The draft keeps both screens faithful.
const editTypeOverrides: Record<string, ActivityTypeId[]> = {
  a1: ['photo', 'text', 'video', 'scale'],
}

function draftFromActivity(activity: ActivitySummary): ActivityDraft {
  const types = editTypeOverrides[activity.id] ?? activity.types
  const hasScale = activity.scale !== null || types.includes('scale')

  return {
    id: activity.id,
    code: activity.code,
    title: activity.title,
    instruction: activity.description,
    types: [...types],
    scale: {
      kind: activity.scale?.kind ?? 'number',
      points: activity.scale?.points ?? 7,
      lowLabel: hasScale ? 'Muito mal' : '',
      highLabel: hasScale ? 'Muito bem' : '',
      midLabel: '',
    },
    effortMinutes: activity.effortMinutes,
    locationRequested: activity.locationRequested,
    freeEntriesEnabled: activity.freeEntries.enabled,
    freeEntriesPerDay: activity.freeEntries.maxPerDay,
    windowStart: activity.windowStart,
    windowEnd: activity.windowEnd,
    requestsPerDay: activity.requestsPerDay,
    minGapMinutes: activity.minGapMinutes,
  }
}

export function getActivityDraft(activityId?: string): ActivityDraft {
  const activity = activities.find((item) => item.id === activityId)
  if (activity) {
    return draftFromActivity(activity)
  }

  return {
    id: null,
    code: nextActivityCode(),
    title: '',
    instruction: '',
    types: ['photo', 'text'],
    scale: {
      kind: 'number',
      points: 7,
      lowLabel: 'Muito mal',
      highLabel: 'Muito bem',
      midLabel: '',
    },
    effortMinutes: 1,
    locationRequested: false,
    freeEntriesEnabled: false,
    freeEntriesPerDay: 1,
    windowStart: '08:00',
    windowEnd: '22:00',
    requestsPerDay: 1,
    minGapMinutes: 60,
  }
}

export function effortTotalPerDay(): number {
  return activities.reduce(
    (total, activity) => total + activity.effortMinutes * activity.requestsPerDay,
    0,
  )
}

export function requestsTotalPerDay(): number {
  return activities.reduce((total, activity) => total + activity.requestsPerDay, 0)
}

/* Study settings */

export type ScheduleStyleId = 'fixed' | 'balanced' | 'varied'
export type TeamRole = 'owner' | 'collaborator'
export type TeamTone = 'blue' | 'teal' | 'amber'
export type QuestionType = 'single' | 'multiple' | 'yesno'

export type TeamMember = {
  id: string
  initials: string
  name: string
  email: string
  note: string
  role: TeamRole
  tone: TeamTone
}

export type StudyQuestion = {
  id: string
  text: string
  type: QuestionType
  options: string[]
}

export type PosterOptions = {
  studyCode: string
  acceptCodeEntries: boolean
  posterQr: boolean
  posterCode: boolean
}

export type StudySettings = {
  title: string
  description: string
  startDate: string
  endDate: string
  timezone: string
  scheduleStyle: ScheduleStyleId
  maxRequestsPerDay: number
  maxRequestsPerWindow: number
  consentVersion: number
  consentAcceptedBy: number
  consentPt: string
  consentEn: string
  questions: StudyQuestion[]
  team: TeamMember[]
  poster: PosterOptions
}

const baseSettings: StudySettings = {
  title: demoStudyTitle,
  description:
    'Como é que os moradores usam o Jardim da Estrela ao longo do dia, durante duas semanas.',
  startDate: '6 out. 2026',
  endDate: '19 out. 2026',
  timezone: 'Europe/Lisboa',
  scheduleStyle: 'varied',
  maxRequestsPerDay: 4,
  maxRequestsPerWindow: 3,
  consentVersion: 2,
  consentAcceptedBy: 22,
  consentPt:
    'Li e compreendi o objetivo deste estudo. Aceito participar de forma voluntária e sei que posso desistir a qualquer momento, sem prejuízo.',
  consentEn:
    'I have read and understood the purpose of this study. I agree to take part voluntarily and understand that I may withdraw at any time without consequence.',
  questions: [
    {
      id: 'q1',
      text: 'Com que frequência vai ao Jardim da Estrela?',
      type: 'single',
      options: ['Todos os dias', 'Algumas vezes por semana', 'Algumas vezes por mês', 'Raramente'],
    },
    {
      id: 'q2',
      text: 'Como costuma chegar ao jardim?',
      type: 'multiple',
      options: ['A pé', 'De bicicleta', 'Transportes públicos', 'De carro', 'Outro'],
    },
    {
      id: 'q3',
      text: 'Mora ou trabalha perto do jardim?',
      type: 'yesno',
      options: ['Sim', 'Não'],
    },
  ],
  team: [
    {
      id: 'u1',
      initials: 'IM',
      name: 'Inês Marques',
      email: 'ines.marques@unidcom.pt',
      note: '',
      role: 'owner',
      tone: 'blue',
    },
    {
      id: 'u2',
      initials: 'DL',
      name: 'Duarte Lopes',
      email: '',
      note: 'Não vê identidades',
      role: 'collaborator',
      tone: 'teal',
    },
  ],
  poster: {
    studyCode: 'JARDIM-4K7Q',
    acceptCodeEntries: true,
    posterQr: true,
    posterCode: true,
  },
}

export function getStudySettings(): StudySettings {
  return structuredClone(baseSettings)
}

export function nextActivityCode(): string {
  return `A${activities.length + 1}`
}
