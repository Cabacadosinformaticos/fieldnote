export type StudyStatus = 'active' | 'ended' | 'erasing';

export type Study = {
  id: string;
  name: string;
  status: StudyStatus;
  isNow?: boolean;
  openRequests?: number;
  openUntil?: string;
  eraseDate?: string;
  description: string;
  period: string;
  day: number;
  totalDays: number;
  team: string;
  email: string;
};

export const moreStudies: Study[] = [
  {
    id: 'jardim',
    name: 'Viver o Jardim da Estrela',
    status: 'active',
    isNow: true,
    openRequests: 1,
    description:
      'Como é que os moradores usam o Jardim da Estrela ao longo do dia, durante duas semanas.',
    period: '6 a 19 out. 2026',
    day: 4,
    totalDays: 14,
    team: 'Inês Marques · UNIDCOM/IADE',
    email: 'ines.marques@unidcom.pt',
  },
  {
    id: 'compras',
    name: 'Ir às compras no bairro',
    status: 'active',
    openRequests: 1,
    openUntil: '18:00',
    description:
      'Que lojas e serviços do bairro fazem parte da rotina de quem aqui vive.',
    period: '1 a 31 out. 2026',
    day: 9,
    totalDays: 31,
    team: 'Rita Ferraz · UNIDCOM/IADE',
    email: 'rita.ferraz@unidcom.pt',
  },
  {
    id: 'pequenos',
    name: 'Pequenos-almoços em casa',
    status: 'erasing',
    eraseDate: '16 out.',
    description:
      'O que come ao pequeno-almoço e como essa rotina mudou nas últimas semanas.',
    period: '15 set. a 5 out. 2026',
    day: 21,
    totalDays: 21,
    team: 'Duarte Lopes · UNIDCOM/IADE',
    email: 'duarte.lopes@unidcom.pt',
  },
];

export function getStudy(id: string | undefined): Study | undefined {
  return moreStudies.find((study) => study.id === id);
}

export const endedStudy = {
  name: 'Viver o Jardim da Estrela',
  endedDate: '19 de outubro de 2026',
  teamName: 'Inês Marques',
  teamEmail: 'ines.marques@unidcom.pt',
} as const;

export const removedStudy = {
  id: 'jardim',
  name: 'Viver o Jardim da Estrela',
  teamName: 'Inês Marques',
  teamEmail: 'ines.marques@unidcom.pt',
} as const;

export type ErasureSummary = {
  scope: 'study' | 'all';
  studyName?: string;
  requestedTime: string;
  date: string;
  time: string;
};

export const moreErasures: Record<'study' | 'all', ErasureSummary> = {
  study: {
    scope: 'study',
    studyName: 'Pequenos-almoços em casa',
    requestedTime: '11:20',
    date: '16 out.',
    time: '11:20',
  },
  all: {
    scope: 'all',
    requestedTime: '14:32',
    date: '16 out.',
    time: '14:32',
  },
};

export type AvailabilityInterval = {
  id: number;
  from: number;
  to: number;
  days: boolean[];
};

export const moreAvailability = {
  anyTime: false,
  intervals: [
    { id: 1, from: 18, to: 22, days: [true, true, true, true, true, false, false] },
    { id: 2, from: 37, to: 43, days: [true, true, true, true, true, false, false] },
    { id: 3, from: 20, to: 44, days: [false, false, false, false, false, true, true] },
  ] satisfies AvailabilityInterval[],
};

export const moreNotification = {
  id: 'new-activity',
  time: '14:15',
  body: 'Tem uma nova atividade disponível.',
} as const;
