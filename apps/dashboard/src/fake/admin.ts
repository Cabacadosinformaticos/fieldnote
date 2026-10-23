import type { AdminKey } from '../i18n/admin'

/* Researcher accounts */

export type AccountRole = 'researcher' | 'admin'
export type AccountState = 'active' | 'disabled' | 'blocked'

export type AdminAccount = {
  id: string
  initials: string
  name: string
  email: string
  role: AccountRole
  roleLabel: string
  studies: string
  lastDay: string
  lastTime: string
  state: AccountState
  totp: boolean
  self?: boolean
}

export const accounts: AdminAccount[] = [
  {
    id: 'carla-nunes',
    initials: 'CN',
    name: 'Carla Nunes',
    email: 'carla.nunes@unidcom.pt',
    role: 'admin',
    roleLabel: 'Administradora',
    studies: 'Todos (administração)',
    lastDay: 'Hoje',
    lastTime: '14:05',
    state: 'active',
    totp: true,
    self: true,
  },
  {
    id: 'ines-marques',
    initials: 'IM',
    name: 'Inês Marques',
    email: 'ines.marques@unidcom.pt',
    role: 'researcher',
    roleLabel: 'Investigadora',
    studies: 'S1 (proprietária), S2 e S3 (colaboradora)',
    lastDay: 'Hoje',
    lastTime: '09:02',
    state: 'active',
    totp: false,
  },
  {
    id: 'duarte-lopes',
    initials: 'DL',
    name: 'Duarte Lopes',
    email: 'duarte.lopes@unidcom.pt',
    role: 'researcher',
    roleLabel: 'Investigador',
    studies: 'S1 (colaborador)',
    lastDay: 'Hoje',
    lastTime: '09:13',
    state: 'active',
    totp: false,
  },
  {
    id: 'rita-ferraz',
    initials: 'RF',
    name: 'Rita Ferraz',
    email: 'rita.ferraz@unidcom.pt',
    role: 'researcher',
    roleLabel: 'Investigadora',
    studies: 'S2 e S3 (proprietária)',
    lastDay: '8 out.',
    lastTime: '17:48',
    state: 'active',
    totp: false,
  },
  {
    id: 'joao-pires',
    initials: 'JP',
    name: 'João Pires',
    email: 'joao.pires@unidcom.pt',
    role: 'researcher',
    roleLabel: 'Investigador',
    studies: 'Nenhum',
    lastDay: '22 set.',
    lastTime: '10:15',
    state: 'disabled',
    totp: false,
  },
]

/* All studies */

export type AdminStudyState = 'ongoing' | 'draft' | 'finished'

export type AdminStudy = {
  id: string
  slug: string
  title: string
  style: string
  state: AdminStudyState
  dates: string
  datesNote: string
  team: { name: string; role: string }[]
  people: string
  peopleNote: string
  entries: string
  adherence: string
  adherenceNote: string
}

export type AdminKpi = { labelKey: AdminKey; value: string; note: string }

export const studyKpis: AdminKpi[] = [
  {
    labelKey: 'studies.kpi.platform',
    value: '4',
    note: '2 em curso, 1 rascunho, 1 terminado',
  },
  { labelKey: 'studies.kpi.investigators', value: '3', note: 'Inês, Duarte e Rita' },
  { labelKey: 'studies.kpi.participants', value: '72', note: '24 em S1, 30 em S4, 18 em S3' },
  {
    labelKey: 'studies.kpi.entries',
    value: '2 192',
    note: '268 em S1, 412 em S4, 1 512 em S3',
  },
]

export const adminStudies: AdminStudy[] = [
  {
    id: 'S1',
    slug: 'jardim-da-estrela',
    title: 'Viver o Jardim da Estrela',
    style: 'variado',
    state: 'ongoing',
    dates: '6 out. a 19 out. 2026',
    datesNote: 'Dia 4 de 14',
    team: [
      { name: 'Inês Marques', role: 'proprietária' },
      { name: 'Duarte Lopes', role: 'colaborador' },
    ],
    people: '24',
    peopleNote: '22 ativos',
    entries: '268',
    adherence: '71 %',
    adherenceNote: 'hoje',
  },
  {
    id: 'S2',
    slug: 'trajetos-casa-faculdade',
    title: 'Trajetos casa-faculdade',
    style: 'fixo',
    state: 'draft',
    dates: '2 nov. a 15 nov. 2026',
    datesNote: 'Previstas, ainda não iniciado',
    team: [
      { name: 'Rita Ferraz', role: 'proprietária' },
      { name: 'Inês Marques', role: 'colaboradora' },
    ],
    people: '0',
    peopleNote: '12 previstos',
    entries: '0',
    adherence: '—',
    adherenceNote: 'sem dados',
  },
  {
    id: 'S3',
    slug: 'pequenos-almocos-em-casa',
    title: 'Pequenos-almoços em casa',
    style: 'equilibrado',
    state: 'finished',
    dates: '7 set. a 20 set. 2026',
    datesNote: 'Terminou há 19 dias',
    team: [
      { name: 'Rita Ferraz', role: 'proprietária' },
      { name: 'Inês Marques', role: 'colaboradora' },
    ],
    people: '18',
    peopleNote: '1 apagamento por tratar, 1 agendado',
    entries: '1 512',
    adherence: '81 %',
    adherenceNote: 'final',
  },
  {
    id: 'S4',
    slug: 'ir-as-compras-no-bairro',
    title: 'Ir às compras no bairro',
    style: 'equilibrado',
    state: 'ongoing',
    dates: '1 out. a 31 out. 2026',
    datesNote: 'Dia 9 de 31',
    team: [{ name: 'Rita Ferraz', role: 'proprietária' }],
    people: '30',
    peopleNote: 'todos vindos da bolsa',
    entries: '412',
    adherence: '84 %',
    adherenceNote: 'hoje',
  },
]

/* Volunteer pool */

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

/* Audit log */

export type AuditActorType = 'user' | 'participant' | 'system'

export type AuditEvent = {
  id: string
  date: string
  day: string
  time: string
  actorType: AuditActorType
  actor: string
  action: string
  target: string
  detail: string
  ip: string
  via: string
  failed?: boolean
  fields?: { k: string; v: string }[]
}

const event = (
  id: string,
  date: string,
  day: string,
  time: string,
  actorType: AuditActorType,
  actor: string,
  action: string,
  target: string,
  detail: string,
  ip: string,
  via: string,
  extra: Pick<AuditEvent, 'failed' | 'fields'> = {},
): AuditEvent => ({
  id,
  date,
  day,
  time,
  actorType,
  actor,
  action,
  target,
  detail,
  ip,
  via,
  ...extra,
})

export const auditEvents: AuditEvent[] = [
  event(
    'AUD-001284',
    '2026-10-09',
    '9 out.',
    '14:29:03',
    'user',
    'Duarte Lopes',
    'Exportação de dados',
    'S1 · Viver o Jardim da Estrela',
    'CSV com 268 registos. Incluído: localização. Não incluído: ficheiros de media, identidade.',
    '203.0.113.41',
    'Portal · Chrome',
    {
      fields: [
        { k: 'Evento', v: 'AUD-001284' },
        { k: 'Âmbito', v: 'Todos os registos do estudo (268)' },
        { k: 'Formato', v: 'CSV' },
        {
          k: 'Colunas',
          v: 'Pseudónimo, atividade, pedido, tipo, conteúdo, gravado, recebido, etiquetas, localização',
        },
        { k: 'Localização', v: 'Incluída' },
        { k: 'Ficheiros de media', v: 'Não incluídos' },
        { k: 'Identidade', v: 'Não incluída' },
        { k: 'Perfil na altura', v: 'Colaborador do estudo S1' },
      ],
    },
  ),
  event(
    'AUD-001283',
    '2026-10-09',
    '9 out.',
    '14:12:30',
    'user',
    'Inês Marques',
    'Ligação de media emitida',
    'Foto de P-12, S1',
    'Ligação de visualização válida durante 10 minutos, para um só ficheiro.',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001282',
    '2026-10-09',
    '9 out.',
    '14:05:18',
    'user',
    'Carla Nunes',
    'Início de sessão',
    'Conta de Carla Nunes',
    'Com palavra-passe e código TOTP.',
    '198.51.100.7',
    'Portal · Edge',
  ),
  event(
    'AUD-001281',
    '2026-10-09',
    '9 out.',
    '11:20:41',
    'participant',
    'P-14 (S3)',
    'Apagamento pedido na app',
    'S3 · Pequenos-almoços em casa',
    'Pedido de apagamento dos dados do estudo. Dados escondidos da equipa, fora das exportações e das cópias de segurança. Apagamento automático agendado para 16 out., 11:20. Só o pseudónimo fica registado.',
    '198.51.100.84',
    'Aplicação Android',
  ),
  event(
    'AUD-001280',
    '2026-10-09',
    '9 out.',
    '11:08:47',
    'participant',
    'Pessoa por aprovar',
    'Entrada por código de cartaz',
    'S1 · Viver o Jardim da Estrela',
    'Código «Cartaz no quiosque do jardim». À espera de aprovação da equipa; ainda não há pseudónimo nem pedidos.',
    '198.51.100.109',
    'Aplicação Android',
  ),
  event(
    'AUD-001279',
    '2026-10-09',
    '9 out.',
    '09:13:22',
    'user',
    'Duarte Lopes',
    'Início de sessão',
    'Conta de Duarte Lopes',
    'Com palavra-passe.',
    '203.0.113.41',
    'Portal · Chrome',
  ),
  event(
    'AUD-001278',
    '2026-10-09',
    '9 out.',
    '09:12:55',
    'user',
    'Duarte Lopes',
    'Início de sessão',
    'Conta de Duarte Lopes',
    'Palavra-passe incorreta, 1.ª tentativa seguida.',
    '203.0.113.41',
    'Portal · Chrome',
    { failed: true },
  ),
  event(
    'AUD-001277',
    '2026-10-09',
    '9 out.',
    '09:02:11',
    'user',
    'Inês Marques',
    'Leitura de identidade',
    'Participante P-07, S1',
    'Consulta do nome e do e-mail, como proprietária do estudo.',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001276',
    '2026-10-09',
    '9 out.',
    '03:41:10',
    'user',
    'Pessoa não identificada',
    'Início de sessão',
    'Endereço de e-mail sem conta',
    'A pessoa viu a mesma mensagem de erro que numa palavra-passe errada.',
    '192.0.2.88',
    'Portal · Chrome',
    { failed: true },
  ),
  event(
    'AUD-001275',
    '2026-10-09',
    '9 out.',
    '03:00:00',
    'system',
    'Planeamento diário',
    'Plano diário concluído',
    'S1 · Viver o Jardim da Estrela',
    '85 de 88 pedidos planeados em 1,8 s, pesquisa completa. 3 ficaram por planear.',
    'Tarefa agendada',
    'Sem endereço',
  ),
  event(
    'AUD-001274',
    '2026-10-08',
    '8 out.',
    '19:13:02',
    'system',
    'Processamento de media',
    'Ficheiro com falha',
    'Vídeo de P-09, S1',
    'Não foi possível converter o vídeo. Tentar de novo está disponível ao investigador.',
    'Tarefa automática',
    'Sem endereço',
  ),
  event(
    'AUD-001273',
    '2026-10-08',
    '8 out.',
    '17:52:36',
    'user',
    'Rita Ferraz',
    'Alteração de estudo',
    'S2 · Trajetos casa-faculdade',
    'Data de início prevista: de 26 out. para 2 nov.',
    '198.51.100.23',
    'Portal · Safari',
  ),
  event(
    'AUD-001272',
    '2026-10-08',
    '8 out.',
    '17:42:19',
    'participant',
    'Pessoa por aprovar',
    'Entrada por código de cartaz',
    'S1 · Viver o Jardim da Estrela',
    'Código «Cartaz no quiosque do jardim». À espera de aprovação da equipa; ainda não há pseudónimo nem pedidos.',
    '198.51.100.57',
    'Aplicação Android',
  ),
  event(
    'AUD-001271',
    '2026-10-08',
    '8 out.',
    '10:05:31',
    'user',
    'Inês Marques',
    'Código de cartaz criado',
    'S1 · Viver o Jardim da Estrela',
    'Código reutilizável «Cartaz no quiosque do jardim»: válido até 12 out., limite de 10 entradas, com aprovação de cada entrada pela equipa.',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001270',
    '2026-10-07',
    '7 out.',
    '16:20:48',
    'user',
    'Inês Marques',
    'Código de cartaz desligado',
    'S1 · Viver o Jardim da Estrela',
    'Código «Folheto da junta de freguesia» desligado. Deixou de aceitar entradas; ninguém tinha entrado.',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001269',
    '2026-10-07',
    '7 out.',
    '15:22:09',
    'user',
    'Inês Marques',
    'Alteração de estudo',
    'S1 · Viver o Jardim da Estrela',
    'Máximo de pedidos por intervalo de 15 minutos: de 2 para 3 (valor sugerido).',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001268',
    '2026-10-06',
    '6 out.',
    '18:05:44',
    'participant',
    'P-12 (S1)',
    'Consentimento aceite',
    'S1 · texto de consentimento, versão 2 (pt)',
    'Aceite na aplicação. Só o pseudónimo fica registado.',
    '198.51.100.62',
    'Aplicação Android',
  ),
  event(
    'AUD-001267',
    '2026-10-06',
    '6 out.',
    '10:15:00',
    'system',
    'Convites da bolsa',
    'Convites expirados',
    'S4 · Ir às compras no bairro',
    '5 convites ficaram sem resposta durante 7 dias e deixaram de ser válidos. 30 aceites e 6 recusados.',
    'Tarefa agendada',
    'Sem endereço',
  ),
  event(
    'AUD-001266',
    '2026-10-06',
    '6 out.',
    '09:00:12',
    'user',
    'Inês Marques',
    'Alteração de estudo',
    'S1 · Viver o Jardim da Estrela',
    'Estado: de rascunho para em curso.',
    '203.0.113.17',
    'Portal · Firefox',
  ),
  event(
    'AUD-001265',
    '2026-10-02',
    '2 out.',
    '11:36:20',
    'user',
    'Carla Nunes',
    'Apagamento de participante',
    'Participante P-02, S3',
    'Identidade, 31 registos e 26 ficheiros apagados. Cópias de segurança até 7 dias.',
    '198.51.100.7',
    'Portal · Edge',
  ),
  event(
    'AUD-001264',
    '2026-10-01',
    '1 out.',
    '10:02:15',
    'user',
    'Carla Nunes',
    'Conta desativada',
    'Conta de João Pires',
    'Sessões terminadas em todos os dispositivos.',
    '198.51.100.7',
    'Portal · Edge',
  ),
  event(
    'AUD-001263',
    '2026-09-29',
    '29 set.',
    '10:15:00',
    'user',
    'Rita Ferraz',
    'Convites da bolsa enviados',
    'S4 · Ir às compras no bairro',
    '41 convites enviados a pessoas da bolsa que cumprem os critérios. Válidos durante 7 dias. A equipa só vê o número, nunca os perfis.',
    '198.51.100.23',
    'Portal · Safari',
  ),
]

export const auditActions = Array.from(new Set(auditEvents.map((item) => item.action)))

/* Erasure requests */

export type ErasureAppRow = {
  alias: string
  study: string
  title: string
  studyNote: string
  asked: string
  erase: string
  backups: string
  state: string
}

export const erasureAppRows: ErasureAppRow[] = [
  {
    alias: 'P-14',
    study: 'S3',
    title: 'Pequenos-almoços em casa',
    studyNote: 'terminado a 20 set. 2026',
    asked: '9 out., 11:20',
    erase: '16 out., 11:20',
    backups: 'Sem os dados desde 9 out.',
    state: 'Agendado. O participante ainda pode cancelar',
  },
]

export const erasurePending = {
  alias: 'P-05',
  study: 'S3',
  studyTitle: 'Pequenos-almoços em casa',
  studyNote: 'terminado a 20 set. 2026',
  requestedBy: 'Rita Ferraz, proprietária',
  receivedAt: '8 out., 17:55',
  decidedAt: 'Aceite a 9 out., 10:40',
}

export const erasureDeleted = [
  {
    title: 'Identidade de P-05',
    note: 'Nome e e-mail guardados à parte, que só a proprietária e a administração podiam ver.',
  },
  {
    title: '47 registos',
    note: '28 fotos, 5 vídeos, 6 áudios, 6 textos e 2 respostas de escala, entre 7 e 20 set.',
  },
  {
    title: '39 ficheiros',
    note: 'As fotos, os vídeos e os áudios, com todas as cópias que o sistema guarda de cada um.',
  },
  {
    title: 'Ligação ao estudo',
    note: 'P-05 continua na lista de S3 com o estado Apagado, sem dados.',
  },
]

export const erasureKept = [
  {
    title: 'Registos de auditoria',
    note: 'Ficam só com o pseudónimo P-05, nunca o nome. Não podem ser alterados nem apagados.',
  },
  {
    title: 'Contagens do estudo',
    note: 'S3 continua a indicar 18 participantes. Os registos recebidos passam de 1 512 para 1 465.',
  },
  {
    title: 'Cópias de segurança',
    note: 'Os dados saem delas em 7 dias, até 16 out. 2026. O texto de consentimento já diz isto.',
  },
  {
    title: 'Fora do alcance da plataforma',
    note: 'Exportações que a equipa já fez e registos ainda por enviar no telemóvel do participante.',
  },
]

export const erasureSteps = [
  {
    n: '1',
    title: 'Apagamento imediato',
    note: 'A identidade, os registos e os ficheiros desaparecem do sistema em ativo, em todas as cópias.',
  },
  {
    n: '2',
    title: 'Verificar o resultado',
    note: 'Se alguma cópia estiver indisponível, o apagamento aplica-se quando voltar. Confirme depois na auditoria.',
  },
  {
    n: '3',
    title: 'Avisar o participante',
    note: 'Diga-lhe, através de Rita Ferraz, que as cópias de segurança guardam os dados até 7 dias.',
  },
]

export const erasureHistory = {
  alias: 'P-02',
  study: 'S3',
  note: '2 out., 11:36 por Carla Nunes. 31 registos e 26 ficheiros. Sai das cópias de segurança até 9 out.',
}

/* Second sign-in step */

export const adminEmail = 'carla.nunes@unidcom.pt'
