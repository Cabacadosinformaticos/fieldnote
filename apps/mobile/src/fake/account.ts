export const accountRecoveryCode = 'FN7Q-K2XM-9TRB-4WHD';

export const accountEmail = {
  full: 'teresa@exemplo.pt',
  masked: 't•••@exemplo.pt',
} as const;

export type RestoredStudy = {
  id: string;
  name: string;
  status: 'active' | 'ended' | 'pool';
  erasingDate?: string;
  memberSince?: string;
};

export const restoredStudies: RestoredStudy[] = [
  {
    id: 'jardim',
    name: 'Viver o Jardim da Estrela',
    status: 'active',
  },
  {
    id: 'compras',
    name: 'Ir às compras no bairro',
    status: 'active',
  },
  {
    id: 'pequenos',
    name: 'Pequenos-almoços em casa',
    status: 'ended',
    erasingDate: '16 out.',
  },
  {
    id: 'bolsa',
    name: 'Bolsa de voluntários',
    status: 'pool',
    memberSince: '28 set.',
  },
];

export const poolMember = {
  since: '28 set.',
  concelho: 'Lisboa',
  freguesia: 'Estrela',
  age: '25-34',
  gender: 'Prefiro não dizer',
  situation: 'Trabalhador por conta de outrem',
  transport: 'A pé',
  languages: ['Português'],
} as const;

export const poolProfileDefaults = {
  concelho: 'Lisboa',
  freguesia: 'Estrela',
  age: '25-34',
  situation: 'Trabalhador por conta de outrem',
  transport: 'A pé',
  languages: ['Português'],
} as const;

export const poolConcelhos = [
  'Amadora',
  'Cascais',
  'Lisboa',
  'Loures',
  'Odivelas',
  'Oeiras',
  'Sintra',
] as const;

export const poolFreguesias: Record<string, string[]> = {
  Amadora: [
    'Alfragide',
    'Brandoa',
    'Encosta do Sol',
    'Falagueira-Venda Nova',
    'Mina de Água',
    'Reboleira',
    'Venteira',
  ],
  Cascais: [
    'Alcabideche',
    'Carcavelos e Parede',
    'Cascais e Estoril',
    'São Domingos de Rana',
  ],
  Lisboa: [
    'Alvalade',
    'Arroios',
    'Campo de Ourique',
    'Campolide',
    'Estrela',
    'Misericórdia',
    'Santo António',
  ],
  Loures: [
    'Bucelas',
    'Camarate',
    'Frielas',
    'Loures',
    'Moscavide e Portela',
    'Sacavém',
    'Santa Iria de Azóia',
  ],
  Odivelas: [
    'Odivelas',
    'Olival Basto',
    'Pontinha e Famões',
    'Póvoa de Santo Adrião',
    'Ramada e Caneças',
  ],
  Oeiras: [
    'Algés, Linda-a-Velha e Cruz Quebrada',
    'Barcarena',
    'Carnaxide e Queijas',
    'Oeiras e São Julião da Barra',
    'Porto Salvo',
  ],
  Sintra: [
    'Algueirão-Mem Martins',
    'Belas',
    'Cacém e São Marcos',
    'Colares',
    'Massamá e Monte Abraão',
    'Queluz e Belas',
    'Rio de Mouro',
    'Sintra',
  ],
};

export const poolAgeGroups = [
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65 ou mais',
  'Prefiro não dizer',
] as const;

export const poolGenders = [
  'Feminino',
  'Masculino',
  'Outro',
  'Prefiro não dizer',
] as const;

export const poolSituations = [
  'Estudante',
  'Trabalhador por conta de outrem',
  'Trabalhador por conta própria',
  'Desempregado',
  'Reformado',
  'Outra',
  'Prefiro não dizer',
] as const;

export const poolTransports = [
  'A pé',
  'Transportes públicos',
  'Carro',
  'Bicicleta ou trotinete',
  'Outro',
  'Prefiro não dizer',
] as const;

export const poolLanguages = ['Português', 'Inglês', 'Prefiro não dizer'] as const;

export const poolInvitation = {
  studyName: 'Ir às compras no bairro',
  description: 'As compras do dia a dia no seu bairro, durante um mês.',
  received: '29 set.',
  validUntil: '6 out.',
  team: 'Rita Ferraz, UNIDCOM/IADE',
  period: '1 a 31 out. 2026 (31 dias)',
  requests: '1 pedido por dia, cerca de 2 min',
  records: 'Uma foto ou um texto',
  location: 'Só em atividades que o indiquem',
  concelho: 'Lisboa',
} as const;

export const poolNotification = {
  date: 'terça-feira, 29 de setembro',
  time: '10:05',
} as const;
