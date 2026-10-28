import type {
  AgeBand,
  Gender,
  Locale,
  Occupation,
  TransportMode,
} from '@/state/actions';

export type PoolOption = { label: string; value: string | null };

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

export const poolAgeOptions: readonly PoolOption[] = [
  { label: '18-24', value: '18-24' },
  { label: '25-34', value: '25-34' },
  { label: '35-44', value: '35-44' },
  { label: '45-54', value: '45-54' },
  { label: '55-64', value: '55-64' },
  { label: '65 ou mais', value: '65+' },
  { label: 'Prefiro não dizer', value: null },
];

export const poolGenderOptions: readonly PoolOption[] = [
  { label: 'Feminino', value: 'female' },
  { label: 'Masculino', value: 'male' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro não dizer', value: null },
];

export const poolSituationOptions: readonly PoolOption[] = [
  { label: 'Estudante', value: 'student' },
  { label: 'Trabalhador por conta de outrem', value: 'employee' },
  { label: 'Trabalhador por conta própria', value: 'self_employed' },
  { label: 'Desempregado', value: 'unemployed' },
  { label: 'Reformado', value: 'retired' },
  { label: 'Outra', value: 'other' },
  { label: 'Prefiro não dizer', value: null },
];

export const poolTransportOptions: readonly PoolOption[] = [
  { label: 'A pé', value: 'walking' },
  { label: 'Transportes públicos', value: 'public_transport' },
  { label: 'Carro', value: 'car' },
  { label: 'Bicicleta ou trotinete', value: 'bicycle' },
  { label: 'Trotinete', value: 'scooter' },
  { label: 'Outro', value: 'other' },
  { label: 'Prefiro não dizer', value: null },
];

export const poolLanguageOptions: readonly PoolOption[] = [
  { label: 'Português', value: 'pt' },
  { label: 'Inglês', value: 'en' },
  { label: 'Prefiro não dizer', value: null },
];

export const poolAgeLabels = poolAgeOptions.map((option) => option.label);
export const poolGenderLabels = poolGenderOptions.map((option) => option.label);
export const poolSituationLabels = poolSituationOptions.map((option) => option.label);
export const poolTransportLabels = poolTransportOptions.map((option) => option.label);
export const poolLanguageLabels = poolLanguageOptions.map((option) => option.label);

function labelFor(options: readonly PoolOption[], value: string | null): string {
  return options.find((option) => option.value === value)?.label ?? '';
}

function valueFor(options: readonly PoolOption[], label: string): string | null {
  return options.find((option) => option.label === label)?.value ?? null;
}

export function ageLabel(value: AgeBand | null): string {
  return labelFor(poolAgeOptions, value);
}

export function ageValue(label: string): AgeBand | null {
  return valueFor(poolAgeOptions, label) as AgeBand | null;
}

export function genderLabel(value: Gender | null): string {
  return labelFor(poolGenderOptions, value);
}

export function genderValue(label: string): Gender | null {
  return valueFor(poolGenderOptions, label) as Gender | null;
}

export function situationLabel(
  value: Occupation | null,
): string {
  return labelFor(poolSituationOptions, value);
}

export function situationValue(
  label: string,
): Occupation | null {
  return valueFor(poolSituationOptions, label) as
    | Occupation
    | null;
}

export function transportLabel(
  value: TransportMode | null,
): string {
  return labelFor(poolTransportOptions, value);
}

export function transportValue(
  label: string,
): TransportMode | null {
  return valueFor(poolTransportOptions, label) as
    | TransportMode
    | null;
}

export function languageLabels(values: string[] | null): string[] {
  return (values ?? []).map((value) => labelFor(poolLanguageOptions, value));
}

export function languageValues(labels: string[]): Locale[] {
  return labels
    .map((label) => valueFor(poolLanguageOptions, label))
    .filter(
      (value): value is Locale =>
        value === 'pt' || value === 'en',
    );
}
