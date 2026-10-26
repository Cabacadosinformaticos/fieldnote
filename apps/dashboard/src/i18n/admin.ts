const pt = {
  'app.name': 'Fieldnote',
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.edit': 'Editar',
  'common.email': 'E-mail',
  'common.retry': 'Tentar de novo',

  /* Researcher accounts */

  'acct.title': 'Contas de investigadores',
  'acct.subtitle':
    'Quem pode entrar no Fieldnote e com que perfil. Ao criar uma conta, a administração entrega uma palavra-passe temporária que só é mostrada uma vez.',
  'acct.new': 'Nova conta',
  'acct.searchLabel': 'Procurar por e-mail',
  'acct.filterLabel': 'Filtrar por estado',
  'acct.filter.all': 'Todas',
  'acct.filter.active': 'Ativas',
  'acct.filter.locked': 'Bloqueadas',
  'acct.sortNote': 'Ordenadas por e-mail',
  'acct.listLabel': 'Lista de contas',
  'acct.col.account': 'Conta',
  'acct.col.role': 'Perfil',
  'acct.col.state': 'Estado',
  'acct.col.totp': 'Código TOTP',
  'acct.col.actions': 'Ações',
  'acct.totp.active': 'Configurado',
  'acct.totp.notRequired': 'Por configurar',
  'acct.state.active': 'Ativa',
  'acct.state.locked': 'Bloqueada',
  'acct.role.admin': 'Administrador',
  'acct.role.researcher': 'Investigador',
  'acct.lock': 'Bloquear',
  'acct.unlock': 'Desbloquear',
  'acct.delete': 'Eliminar',
  'acct.editAria': 'Alterar o perfil de {email}',
  'acct.lockAria': 'Bloquear a conta de {email}',
  'acct.unlockAria': 'Desbloquear a conta de {email}',
  'acct.deleteAria': 'Eliminar a conta de {email}',
  'acct.selfAria': 'Não pode alterar a sua própria conta',
  'acct.footerCountOne': '1 conta',
  'acct.footerCount': '{count} contas',
  'acct.footerNote': 'Uma conta bloqueada mantém o histórico mas já não consegue entrar.',
  'acct.protectionTitle': 'Proteção do início de sessão',
  'acct.protectionText':
    'Depois de várias tentativas falhadas, a conta fica bloqueada durante algum tempo e cada nova tentativa demora mais. As contas de administrador exigem sempre o código TOTP.',
  'acct.deactivateTitle': 'O que acontece ao bloquear',
  'acct.deactivateText':
    'As sessões da pessoa terminam em todos os dispositivos. Uma página que já esteja aberta pode continuar a funcionar até 15 minutos. A alteração fica registada na auditoria.',
  'acct.empty': 'Não há contas com este estado.',
  'acct.loading': 'A carregar as contas…',
  'acct.loadError': 'Não foi possível carregar as contas.',
  'acct.created': 'Conta criada para {email}.',
  'acct.updated': 'Perfil de {email} atualizado.',
  'acct.locked': 'Conta de {email} bloqueada.',
  'acct.unlocked': 'Conta de {email} desbloqueada.',
  'acct.deleted': 'Conta de {email} eliminada.',
  'acct.deleteConfirm':
    'Eliminar definitivamente a conta de {email}? Esta ação não se pode desfazer.',
  'acct.tempTitle': 'Palavra-passe temporária',
  'acct.tempBody':
    'Guarde-a agora: não volta a ser mostrada. Entregue-a a {email} por um canal seguro e peça que a altere no primeiro início de sessão.',
  'acct.tempLabel': 'Palavra-passe',
  'acct.copy': 'Copiar',
  'acct.copied': 'Copiada',
  'acct.tempDone': 'Já guardei',
  'acct.error.emailInUse': 'Já existe uma conta com este e-mail.',
  'acct.error.invalidEmail': 'Introduza um endereço de e-mail válido.',
  'acct.error.self': 'Não pode alterar a sua própria conta desta forma.',
  'acct.error.notFound': 'A conta já não existe. A lista foi atualizada.',
  'acct.error.generic': 'Não foi possível concluir a ação ({code}).',

  'acct.dialog.createTitle': 'Nova conta',
  'acct.dialog.createSubtitle':
    'A conta é criada com uma palavra-passe temporária, mostrada uma única vez depois de criar.',
  'acct.dialog.editTitle': 'Alterar perfil',
  'acct.dialog.editSubtitle': 'Só o perfil pode ser alterado. O e-mail fica como está.',
  'acct.dialog.emailHint': 'Tem de ser único. A conta usa este endereço para entrar.',
  'acct.dialog.role': 'Perfil',
  'acct.dialog.researcherTitle': 'Investigador',
  'acct.dialog.researcherText':
    'Cria e gere os seus estudos e vê os dados dos estudos de que faz parte.',
  'acct.dialog.adminTitle': 'Administrador',
  'acct.dialog.adminText':
    'Gere contas, vê todos os estudos, consulta a auditoria e apaga participantes. Tem de configurar o código TOTP no primeiro início de sessão.',
  'acct.dialog.passwordNoteBefore': 'A palavra-passe temporária ',
  'acct.dialog.passwordNoteStrong': 'é mostrada uma única vez',
  'acct.dialog.passwordNoteAfter':
    '. Guarde-a e entregue-a à pessoa por um canal seguro. Não é enviada por e-mail.',
  'acct.dialog.createSubmit': 'Criar conta',
  'acct.dialog.saveSubmit': 'Guardar perfil',

  /* All studies */

  'studies.title': 'Todos os estudos',
  'studies.subtitle':
    'Os estudos de toda a plataforma, com quem os conduz e quantos dados têm. Aqui não se alteram estudos: isso cabe à equipa de cada um.',
  'studies.kpi.platform': 'Estudos na plataforma',
  'studies.kpi.investigators': 'Investigadores com estudos',
  'studies.kpi.participants': 'Participantes',
  'studies.kpi.entries': 'Registos recebidos',
  'studies.kpi.platformNote': '{running} em curso, {draft} rascunhos, {closed} terminados',
  'studies.kpi.investigatorsNote': 'Contas com acesso a estudos',
  'studies.kpi.participantsNote': 'Somados todos os estudos',
  'studies.kpi.entriesNote': 'Total recebido em todos os estudos',
  'studies.col.study': 'Estudo',
  'studies.col.state': 'Estado',
  'studies.col.dates': 'Datas',
  'studies.col.team': 'Equipa',
  'studies.col.participants': 'Participantes',
  'studies.col.entries': 'Registos',
  'studies.open': 'Abrir',
  'studies.openAria': 'Abrir o estudo {title}',
  'studies.state.draft': 'Rascunho',
  'studies.state.running': 'Em curso',
  'studies.state.closed': 'Terminado',
  'studies.datesNote.draft': 'Previstas, ainda não iniciado',
  'studies.datesNote.running': 'A decorrer',
  'studies.datesNote.closed': 'Terminado',
  'studies.noDates': 'Sem datas',
  'studies.noTeam': 'Sem equipa',
  'studies.loading': 'A carregar os estudos…',
  'studies.loadError': 'Não foi possível carregar os estudos.',
  'studies.empty': 'Ainda não há estudos na plataforma.',
  'studies.identityTitle': 'Identidades dos participantes',
  'studies.identityText':
    'Ao abrir um estudo, os participantes aparecem só com o pseudónimo (por exemplo, P-12). Como administradora, pode consultar o nome e o e-mail de um participante, mas cada consulta fica registada na auditoria com a sua conta e a hora.',
  'studies.role.principal_investigator': 'investigador principal',
  'studies.role.co_investigator': 'co-investigador',
  'studies.role.member': 'membro',

  /* Volunteer pool */

  'pool.title': 'Bolsa de voluntários',
  'pool.subtitle':
    'Pessoas que aceitaram receber convites para estudos. Aqui só se veem totais: nunca há perfis nem pessoas individuais, nem para a administração.',
  'pool.localTitle': 'Resumo local.',
  'pool.localBody':
    ' A API ainda não expõe os totais da bolsa de voluntários; os números desta página vêm dos dados de demonstração.',
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
  'audit.actorUnknown': 'Sem identificação',
  'audit.action': 'Ação',
  'audit.action.all': 'Todas as ações',
  'audit.from': 'De',
  'audit.to': 'Até',
  'audit.heading': '{count} eventos nesta página',
  'audit.order': 'Do mais recente para o mais antigo · horas de Lisboa',
  'audit.col.date': 'Data e hora',
  'audit.col.actor': 'Ator',
  'audit.col.action': 'Ação',
  'audit.col.target': 'Alvo',
  'audit.col.detail': 'Detalhe',
  'audit.failed': 'Falhou',
  'audit.showing': 'A mostrar {shown} eventos',
  'audit.previous': 'Anterior',
  'audit.next': 'Seguinte',
  'audit.page': 'Página {page}',
  'audit.empty': 'Não há eventos com estes filtros.',
  'audit.loading': 'A carregar o registo…',
  'audit.loadError': 'Não foi possível carregar o registo de auditoria.',
  'audit.detailsEmpty': 'Sem detalhe.',
  'audit.action.login': 'Início de sessão',
  'audit.action.login_failed': 'Início de sessão falhado',
  'audit.action.logout': 'Fim de sessão',
  'audit.action.refresh_reuse_detected': 'Reutilização de token detetada',
  'audit.action.totp_enrolment': 'Código TOTP configurado',
  'audit.action.account_created': 'Conta criada',
  'audit.action.account_role_changed': 'Perfil de conta alterado',
  'audit.action.account_locked': 'Conta bloqueada',
  'audit.action.account_unlocked': 'Conta desbloqueada',
  'audit.action.account_deleted': 'Conta eliminada',
  'audit.action.study_created': 'Estudo criado',
  'audit.action.study_updated': 'Estudo alterado',
  'audit.action.study_started': 'Estudo iniciado',
  'audit.action.study_closed': 'Estudo terminado',
  'audit.action.study_member_added': 'Membro adicionado',
  'audit.action.study_member_removed': 'Membro removido',
  'audit.action.study_member_role_changed': 'Perfil de membro alterado',
  'audit.action.study_question_created': 'Pergunta criada',
  'audit.action.study_question_updated': 'Pergunta alterada',
  'audit.action.study_question_deleted': 'Pergunta eliminada',
  'audit.action.study_questions_reordered': 'Perguntas reordenadas',
  'audit.action.study_code_created': 'Código de estudo criado',
  'audit.action.study_code_regenerated': 'Código de estudo regenerado',
  'audit.action.study_code_entry': 'Entrada por código de estudo',
  'audit.action.tag_created': 'Etiqueta criada',
  'audit.action.tag_deleted': 'Etiqueta eliminada',
  'audit.action.activity_created': 'Atividade criada',
  'audit.action.activity_updated': 'Atividade alterada',
  'audit.action.activity_deleted': 'Atividade eliminada',
  'audit.action.participant_added': 'Participante adicionado',
  'audit.action.participant_approved': 'Participante aprovado',
  'audit.action.participant_declined': 'Participante recusado',
  'audit.action.participant_removed': 'Participante removido',
  'audit.action.participant_invite_issued': 'Convite emitido',
  'audit.action.participant_identity_read': 'Identidade consultada',
  'audit.action.participant_erased': 'Participante apagado',
  'audit.action.entry_created': 'Registo recebido',
  'audit.action.media_upload_url_issued': 'Ligação de envio emitida',
  'audit.action.media_url_issued': 'Ligação de media emitida',
  'audit.action.export': 'Exportação de dados',
  'audit.action.erasure_requested': 'Apagamento pedido',
  'audit.action.erasure_cancelled': 'Apagamento cancelado',
  'audit.action.pool_invitations_sent': 'Convites da bolsa enviados',

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
  'erasure.col.state': 'Estado',
  'erasure.scheduledState': 'Agendado. O participante ainda pode cancelar',
  'erasure.app.empty': 'Não há apagamentos agendados.',
  'erasure.app.loading': 'A carregar os pedidos…',
  'erasure.app.loadError': 'Não foi possível carregar os pedidos de apagamento.',
  'erasure.manual.label': 'Pedido recebido fora da app',
  'erasure.manual.title': 'Apagar um participante agora',
  'erasure.manual.status': 'Aguarda confirmação',
  'erasure.manual.note':
    'O pedido chegou por e-mail ou pela equipa do estudo. Confirme o identificador com a equipa: o apagamento é imediato e não se pode desfazer.',
  'erasure.manual.id': 'Identificador do participante',
  'erasure.manual.idHint': 'O UUID que a equipa do estudo enviou, por exemplo 0f8c…',
  'erasure.deletedTitle': 'Vai ser apagado',
  'erasure.keptTitle': 'O que fica',
  'erasure.afterTitle': 'Depois de apagar',
  'erasure.deleted.identity': 'Identidade do participante',
  'erasure.deleted.identityNote':
    'Nome e e-mail guardados à parte, que só a equipa do estudo e a administração podiam ver.',
  'erasure.deleted.entries': 'Registos',
  'erasure.deleted.entriesNote': 'Fotos, vídeos, áudios, textos e respostas de escala.',
  'erasure.deleted.files': 'Ficheiros',
  'erasure.deleted.filesNote': 'As fotos, os vídeos e os áudios, com todas as cópias que o sistema guarda de cada um.',
  'erasure.deleted.link': 'Ligação ao estudo',
  'erasure.deleted.linkNote':
    'O pseudónimo continua na lista do estudo com o estado Apagado, sem dados.',
  'erasure.kept.audit': 'Registos de auditoria',
  'erasure.kept.auditNote':
    'Ficam só com o pseudónimo, nunca o nome. Não podem ser alterados nem apagados.',
  'erasure.kept.counts': 'Contagens do estudo',
  'erasure.kept.countsNote':
    'O estudo continua a indicar o número de participantes; os registos recebidos descem.',
  'erasure.kept.backups': 'Cópias de segurança',
  'erasure.kept.backupsNote':
    'Os dados saem delas em 7 dias. O texto de consentimento já diz isto.',
  'erasure.kept.outside': 'Fora do alcance da plataforma',
  'erasure.kept.outsideNote':
    'Exportações que a equipa já fez e registos ainda por enviar no telemóvel do participante.',
  'erasure.steps.oneTitle': 'Apagamento imediato',
  'erasure.steps.oneNote':
    'A identidade, os registos e os ficheiros desaparecem do sistema em ativo, em todas as cópias.',
  'erasure.steps.twoTitle': 'Verificar o resultado',
  'erasure.steps.twoNote':
    'Se alguma cópia estiver indisponível, o apagamento aplica-se quando voltar. Confirme depois na auditoria.',
  'erasure.steps.threeTitle': 'Avisar o participante',
  'erasure.steps.threeNote':
    'Diga-lhe, através da equipa do estudo, que as cópias de segurança guardam os dados até 7 dias.',
  'erasure.confirm.title': 'Confirmar o apagamento',
  'erasure.confirm.body':
    'Esta ação não se pode desfazer. Nem a administração consegue recuperar o que for apagado.',
  'erasure.confirm.idBefore': 'Escreva o identificador do participante para confirmar',
  'erasure.confirm.repeat': 'Repita o identificador',
  'erasure.confirm.erase': 'Apagar definitivamente',
  'erasure.confirm.cancel': 'Cancelar',
  'erasure.confirm.note':
    'O botão só fica ativo quando os dois identificadores coincidirem. O apagamento fica registado na auditoria com a sua conta, nunca com o nome do participante.',
  'erasure.confirm.success':
    'Participante apagado: {entries} registos e {files} ficheiros.',
  'erasure.error.notFound': 'Não existe nenhum participante com esse identificador.',
  'erasure.error.scheduled':
    'Este participante já tem um apagamento agendado pela app; não é preciso apagar à mão.',
  'erasure.error.generic': 'Não foi possível apagar o participante ({code}).',
  'erasure.historyTitle': 'Apagamentos já feitos',
  'erasure.historyEmpty': 'Ainda não há apagamentos registados.',
  'erasure.historyItem': 'Participante {id}',
  'erasure.historyMeta': '{study} · {date} · {entries} registos e {files} ficheiros',

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
