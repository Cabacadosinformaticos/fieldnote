const pt = {
  'app.name': 'Fieldnote',
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.edit': 'Editar',
  'common.email': 'E-mail',

  /* Researcher accounts */

  'acct.title': 'Contas de investigadores',
  'acct.subtitle':
    'Quem pode entrar no Fieldnote e com que perfil. A palavra-passe é sempre definida pela própria pessoa.',
  'acct.new': 'Nova conta',
  'acct.searchLabel': 'Procurar por nome ou e-mail',
  'acct.filterLabel': 'Filtrar por estado',
  'acct.filter.all': 'Todas',
  'acct.filter.active': 'Ativas',
  'acct.filter.disabled': 'Desativadas',
  'acct.filter.blocked': 'Bloqueadas',
  'acct.sortNote': 'Ordenadas por perfil e nome',
  'acct.listLabel': 'Lista de contas',
  'acct.col.account': 'Conta',
  'acct.col.role': 'Perfil',
  'acct.col.studies': 'Estudos',
  'acct.col.lastSession': 'Última sessão',
  'acct.col.state': 'Estado',
  'acct.col.totp': 'Código TOTP',
  'acct.col.actions': 'Ações',
  'acct.totp.active': 'Ativo',
  'acct.totp.notRequired': 'Não exigido',
  'acct.state.active': 'Ativa',
  'acct.state.disabled': 'Desativada',
  'acct.state.blocked': 'Bloqueada',
  'acct.sendLink': 'Enviar ligação',
  'acct.deactivate': 'Desativar',
  'acct.reactivate': 'Reativar',
  'acct.editAria': 'Editar {name}',
  'acct.sendLinkAria': 'Enviar a {name} uma ligação para nova palavra-passe',
  'acct.deactivateAria': 'Desativar a conta de {name}',
  'acct.reactivateAria': 'Reativar a conta de {name}',
  'acct.selfAria': 'Não pode desativar a sua própria conta',
  'acct.footerCountOne': '1 conta',
  'acct.footerCount': '{count} contas',
  'acct.footerNote': 'Uma conta desativada mantém o histórico mas já não consegue entrar.',
  'acct.protectionTitle': 'Proteção do início de sessão',
  'acct.protectionText':
    'Depois de várias tentativas falhadas, a conta fica bloqueada durante algum tempo e cada nova tentativa demora mais. Neste momento nenhuma conta está bloqueada. As contas de administrador exigem sempre o código TOTP.',
  'acct.deactivateTitle': 'O que acontece ao desativar',
  'acct.deactivateText':
    'As sessões da pessoa terminam em todos os dispositivos. Uma página que já esteja aberta pode continuar a funcionar até 15 minutos. A alteração fica registada na auditoria.',
  'acct.empty': 'Não há contas com este estado.',
  'acct.linkSent': 'Ligação enviada para {email}.',
  'acct.deactivated': 'Conta de {name} desativada.',
  'acct.reactivated': 'Conta de {name} reativada.',
  'acct.created': 'Conta criada. Ligação enviada para {email}.',
  'acct.updated': 'Conta de {name} atualizada.',

  'acct.dialog.createTitle': 'Nova conta de investigador',
  'acct.dialog.createSubtitle':
    'A pessoa recebe uma ligação por e-mail para escolher a sua própria palavra-passe.',
  'acct.dialog.editTitle': 'Editar conta',
  'acct.dialog.editSubtitle':
    'Altere o nome, o e-mail ou o perfil. As alterações ficam registadas na auditoria.',
  'acct.dialog.name': 'Nome completo',
  'acct.dialog.emailHint':
    'É para este endereço que seguem a ligação e os avisos da conta. Tem de ser único.',
  'acct.dialog.role': 'Perfil',
  'acct.dialog.researcherTitle': 'Investigador',
  'acct.dialog.researcherText':
    'Cria e gere os seus estudos e vê os dados dos estudos de que faz parte.',
  'acct.dialog.adminTitle': 'Administrador',
  'acct.dialog.adminText':
    'Gere contas, vê todos os estudos, consulta a auditoria e apaga participantes. Tem de configurar o código TOTP no primeiro início de sessão.',
  'acct.dialog.linkNoteBefore': 'A ligação serve uma única vez e ',
  'acct.dialog.linkNoteStrong': 'é válida durante 30 minutos',
  'acct.dialog.linkNoteAfter':
    '. Se expirar, pode pedir outra na lista de contas. Não escreve nem vê nenhuma palavra-passe.',
  'acct.dialog.createSubmit': 'Criar conta e enviar ligação',
  'acct.dialog.saveSubmit': 'Guardar alterações',

  /* All studies */

  'studies.title': 'Todos os estudos',
  'studies.subtitle':
    'Os estudos de toda a plataforma, com quem os conduz e quantos dados têm. Aqui não se alteram estudos: isso cabe à equipa de cada um.',
  'studies.kpi.platform': 'Estudos na plataforma',
  'studies.kpi.investigators': 'Investigadores com estudos',
  'studies.kpi.participants': 'Participantes',
  'studies.kpi.entries': 'Registos recebidos',
  'studies.col.study': 'Estudo',
  'studies.col.state': 'Estado',
  'studies.col.dates': 'Datas',
  'studies.col.team': 'Equipa',
  'studies.col.participants': 'Participantes',
  'studies.col.entries': 'Registos',
  'studies.col.adherence': 'Adesão',
  'studies.open': 'Abrir',
  'studies.openAria': 'Abrir o estudo {title}',
  'studies.style': 'estilo {style}',
  'studies.state.ongoing': 'Em curso',
  'studies.state.draft': 'Rascunho',
  'studies.state.finished': 'Terminado',
  'studies.identityTitle': 'Identidades dos participantes',
  'studies.identityText':
    'Ao abrir um estudo, os participantes aparecem só com o pseudónimo (por exemplo, P-12). Como administradora, pode consultar o nome e o e-mail de um participante, mas cada consulta fica registada na auditoria com a sua conta e a hora.',

  /* Volunteer pool */

  'pool.title': 'Bolsa de voluntários',
  'pool.subtitle':
    'Pessoas que aceitaram receber convites para estudos. Aqui só se veem totais: nunca há perfis nem pessoas individuais, nem para a administração.',
  'pool.kpi.members': 'Membros na bolsa',
  'pool.kpi.towns': 'Lisboa, Amadora e Odivelas',
  'pool.kpi.invited': 'Convites enviados',
  'pool.kpi.accepted': 'Convites aceites',
  'pool.townsTitle': 'Membros por concelho',
  'pool.townsNote':
    'Número de membros, total {total}. Os 8 concelhos com mais membros e os restantes juntos.',
  'pool.townsFootnote':
    'Em “Outros” estão 57 membros de concelhos com menos de 8 cada. Grupos com menos de 5 pessoas nunca aparecem em separado.',
  'pool.town.other': 'Outros',
  'pool.fieldsTitle': 'Campos preenchidos',
  'pool.fieldsNote':
    'Quantos dos {total} membros indicaram cada campo. Só contagens, nunca os valores de cada pessoa.',
  'pool.fieldsFootnote':
    'O concelho é obrigatório para entrar na bolsa. Quem escolhe “Prefiro não dizer” conta como não preenchido.',
  'pool.field.town': 'Concelho',
  'pool.field.parish': 'Freguesia',
  'pool.field.age': 'Faixa etária',
  'pool.field.gender': 'Género',
  'pool.field.situation': 'Situação',
  'pool.field.travel': 'Como se desloca',
  'pool.field.languages': 'Línguas',
  'pool.invitesTitle': 'Convites enviados e resultado',
  'pool.invitesNote': 'Por estudo. Cada convite vale 7 dias.',
  'pool.invitesMeta': '{count} convites enviados a {when}',
  'pool.invitesBarAria':
    'Dos {total} convites, {accepted} aceites, {refused} recusados e {expired} expirados',
  'pool.legend.accepted': 'aceites',
  'pool.legend.refused': 'recusados',
  'pool.legend.expired': 'expirados',
  'pool.draftLabel': 'Estudo em rascunho',
  'pool.rulesTitle': 'Regras que protegem os membros',
  'pool.rule1':
    'Grupos com menos de 5 pessoas não são mostrados. Aparecem como “menos de 5” e não se podem enviar convites a um grupo assim pequeno.',
  'pool.rule2':
    'Não há lista de pessoas nem perfis individuais: a bolsa não guarda nome, e-mail nem telemóvel.',
  'pool.rule3': 'Quem sai da bolsa vê o perfil apagado de imediato, sem esperar 7 dias.',

  /* Audit log */

  'audit.title': 'Registo de auditoria',
  'audit.subtitle':
    'Quem fez o quê, quando e de onde: inícios de sessão, exportações, consultas de identidade, alterações a estudos, apagamentos e tarefas do sistema.',
  'audit.immutableStrong': 'Este registo não pode ser alterado nem apagado.',
  'audit.immutableBody':
    ' Só se acrescentam linhas novas. Os participantes aparecem apenas pelo pseudónimo, mesmo depois de apagados.',
  'audit.filtersLabel': 'Filtros',
  'audit.actorType': 'Tipo de ator',
  'audit.actor.all': 'Todos',
  'audit.actor.user': 'Utilizador',
  'audit.actor.participant': 'Participante',
  'audit.actor.system': 'Sistema',
  'audit.action': 'Ação',
  'audit.action.all': 'Todas as ações',
  'audit.from': 'De',
  'audit.to': 'Até',
  'audit.search': 'Procurar',
  'audit.searchPlaceholder': 'Pessoa, pseudónimo ou estudo',
  'audit.heading': '{count} eventos entre {from} e {to}',
  'audit.order': 'Do mais recente para o mais antigo · horas de Lisboa',
  'audit.col.date': 'Data e hora',
  'audit.col.actor': 'Ator',
  'audit.col.action': 'Ação',
  'audit.col.target': 'Alvo',
  'audit.col.detail': 'Detalhe',
  'audit.col.origin': 'Origem',
  'audit.failed': 'Falhou',
  'audit.showing': 'A mostrar {shown} de {total}',
  'audit.previous': 'Anterior',
  'audit.next': 'Seguinte',
  'audit.page': 'Página {page} de {pages}',
  'audit.empty': 'Não há eventos com estes filtros.',

  /* Erasure requests */

  'erasure.title': 'Pedidos de apagamento',
  'erasure.subtitle':
    'Os pedidos feitos na app aparecem aqui e cumprem-se sozinhos. Os que chegam por e-mail ou através da equipa são tratados à mão: quando a equipa de um estudo decide aceitar, é aqui que a administração apaga os dados. A decisão é da equipa de investigação.',
  'erasure.app.title': 'Apagamentos pedidos na app',
  'erasure.readOnly': 'Só de leitura',
  'erasure.app.note':
    'Os participantes podem pedir o apagamento na própria app. Os dados ficam logo escondidos da equipa e fora das exportações, e deixam de entrar nas cópias de segurança. O sistema apaga tudo sozinho ao fim de 7 dias; nessa altura as cópias anteriores já expiraram e não resta nenhuma cópia dos dados. Não é preciso fazer nada, e o participante pode cancelar até essa data.',
  'erasure.col.participant': 'Participante',
  'erasure.col.study': 'Estudo',
  'erasure.col.asked': 'Pedido na app',
  'erasure.col.auto': 'Apagamento automático',
  'erasure.col.backups': 'Cópias de segurança',
  'erasure.col.state': 'Estado',
  'erasure.manual.label': 'Pedido por tratar, recebido fora da app',
  'erasure.manual.titleStart': 'Participante ',
  'erasure.manual.titleEnd': ' do estudo {study}',
  'erasure.manual.status': 'Aguarda a administração',
  'erasure.manual.requestedBy': 'Pedido por',
  'erasure.manual.receivedAt': 'Recebido em',
  'erasure.manual.decision': 'Decisão da equipa',
  'erasure.deletedTitle': 'Vai ser apagado',
  'erasure.keptTitle': 'O que fica',
  'erasure.afterTitle': 'Depois de apagar',
  'erasure.confirm.title': 'Confirmar o apagamento',
  'erasure.confirm.body':
    'Esta ação não se pode desfazer. Nem a administração consegue recuperar o que for apagado.',
  'erasure.confirm.aliasBefore': 'Escreva o pseudónimo ',
  'erasure.confirm.aliasAfter': ' para confirmar',
  'erasure.confirm.totp': 'Código TOTP da sua aplicação de autenticação',
  'erasure.confirm.totpHint': '6 dígitos. Muda de 30 em 30 segundos.',
  'erasure.confirm.erase': 'Apagar definitivamente',
  'erasure.confirm.cancel': 'Cancelar',
  'erasure.confirm.note':
    'O botão só fica ativo quando o pseudónimo e o código estiverem corretos. O apagamento fica registado na auditoria com a sua conta e o pseudónimo P-05, nunca com o nome.',
  'erasure.confirm.success':
    'Pedido de {alias} apagado. O acontecimento ficou registado na auditoria.',
  'erasure.historyTitle': 'Apagamentos já feitos',

  /* TOTP second step */

  'totp.back': 'Voltar',
  'totp.title': 'Confirme a sua identidade',
  'totp.subtitleBefore':
    'Contas de administrador precisam de um segundo passo. Abra a aplicação de autenticação do seu telemóvel e escreva o código de 6 dígitos que aparece para a conta ',
  'totp.subtitleAfter': '.',
  'totp.code': 'Código de 6 dígitos',
  'totp.digitAria': 'Dígito {n} de 6',
  'totp.hint': 'O código muda a cada 30 segundos.',
  'totp.submit': 'Verificar e entrar',
  'totp.noAccess':
    'Sem acesso à aplicação de autenticação? Peça a outro administrador que reponha o seu acesso.',
  'totp.heroTitle': 'Acompanhe o dia a dia de quem participa no seu estudo.',
  'totp.heroBody':
    'O Fieldnote é a plataforma onde equipas de investigação preparam estudos de diário e etnografia móvel e seguem os registos dos participantes, em tempo real.',
  'totp.heroBullet1': 'Defina atividades e as horas dos pedidos',
  'totp.heroBullet2': 'Veja fotos, textos, áudios e vídeos à medida que chegam',
  'totp.heroBullet3': 'Organize com etiquetas e exporte os dados',
  'totp.footer': 'Projeto académico, IADE, 2026-27 · Todos os dados mostrados são de demonstração',
} as const

export type AdminKey = keyof typeof pt

export function t(key: AdminKey, values?: Record<string, string | number>): string {
  const template = pt[key]
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}
