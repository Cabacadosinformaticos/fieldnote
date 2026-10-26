// Local fallback for the volunteer-pool overview. The API exposes pool membership and study
// invitations, but no aggregate endpoint with totals, towns or filled-field counts, so this page
// stays on demonstration data until that endpoint exists.
import type { AdminKey } from '../i18n/admin'

export type AdminKpi = { labelKey: AdminKey; value: string; note: string }

export const poolTotal = 214

export const poolKpis: AdminKpi[] = [
  { labelKey: 'pool.kpi.members', value: String(poolTotal), note: 'Sem nomes nem contactos' },
  { labelKey: 'pool.kpi.towns', value: '102', note: '61 + 23 + 18 membros' },
  { labelKey: 'pool.kpi.invited', value: '41', note: 'Todos para o estudo S4' },
  { labelKey: 'pool.kpi.accepted', value: '30', note: '73 % dos enviados' },
]

export type PoolTown = { name: string; count: number; other?: boolean }

export const poolTowns: PoolTown[] = [
  { name: 'Lisboa', count: 61 },
  { name: 'Amadora', count: 23 },
  { name: 'Odivelas', count: 18 },
  { name: 'Oeiras', count: 15 },
  { name: 'Loures', count: 12 },
  { name: 'Sintra', count: 11 },
  { name: 'Cascais', count: 9 },
  { name: 'Almada', count: 8 },
  { name: 'Outros', count: 57, other: true },
]

export type PoolField = { labelKey: AdminKey; count: number }

export const poolFields: PoolField[] = [
  { labelKey: 'pool.field.town', count: 214 },
  { labelKey: 'pool.field.parish', count: 118 },
  { labelKey: 'pool.field.age', count: 181 },
  { labelKey: 'pool.field.gender', count: 142 },
  { labelKey: 'pool.field.situation', count: 163 },
  { labelKey: 'pool.field.travel', count: 127 },
  { labelKey: 'pool.field.languages', count: 196 },
]

export const poolInvites = {
  study: 'S4',
  title: 'Ir às compras no bairro',
  team: 'Rita Ferraz',
  sent: 41,
  when: '29 set.',
  accepted: 30,
  refused: 6,
  expired: 5,
}

export const poolDraft = {
  study: 'S2',
  title: 'Trajetos casa-faculdade',
  note: 'ainda sem convites enviados. A equipa prepara um grupo de 37 pessoas.',
}
