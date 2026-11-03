const daily = {
  'common.listOr': ' ou ',
  'common.comingSoon': 'Em breve',

  'tabs.main': 'Navegação principal',
  'tabs.today': 'Hoje',
  'tabs.entries': 'Registos',
  'tabs.studies': 'Estudos',
  'tabs.profile': 'Horas',

  'type.photo': 'Foto',
  'type.text': 'Texto',
  'type.video': 'Vídeo',
  'type.audio': 'Áudio',
  'type.scale': 'Escala',

  'today.studyDay': '{study} · Dia {day} de {total}',
  'today.studyLine': '{study}',
  'today.studyPending': '{study} · à espera de aprovação',
  'today.title': 'Hoje',
  'today.loading': 'A carregar os pedidos…',
  'today.syncSent': 'Estado do envio: tudo enviado',
  'today.syncWaiting': 'Estado do envio: {count} registos à espera',
  'today.syncFailed': 'Estado do envio: {count} registos com problema',
  'today.syncOpenHint': 'Abrir estado do envio',
  'today.requestAsked': 'Pedido às {time}',
  'today.requestScheduled': 'Pedido previsto para as {time}',
  'today.requestOpen': 'Pedido em aberto',
  'today.requestMeta': '{types} · Demora cerca de {minutes} min',
  'today.closesAt': 'Fecha às {time}',
  'today.answerNow': 'Responder agora',
  'today.unsupportedAnswer': 'Tipo de resposta não suportado',
  'today.unsupportedTypes': 'tipo não suportado',
  'today.otherPrompts': 'Outros pedidos ({count})',
  'today.fromStudy': '{study} · {types}',
  'today.noRequestTitle': 'Não há pedidos em aberto',
  'today.noRequestBody':
    'Quando a equipa do estudo enviar um novo pedido, ele aparece aqui.',
  'today.pendingTitle': 'Participação à espera de aprovação',
  'today.pendingBody':
    'A equipa do estudo ainda tem de aceitar a sua participação. Volte a verificar mais tarde.',
  'today.noStudyTitle': 'Ainda não participa em nenhum estudo',
  'today.noStudyBody':
    'Introduza o código do convite que recebeu para começar a responder aos pedidos.',
  'today.enterStudy': 'Entrar num estudo',
  'today.offline': 'Sem ligação. Está a ver os últimos pedidos guardados.',
  'today.retry': 'Tentar',
  'today.freeTitle': 'Registo livre',
  'today.freeBody':
    'Quer registar um momento, um sítio ou algo que lhe chamou a atenção? Pode fazê-lo a qualquer hora, sem esperar por um pedido.',
  'today.freeUsed': '{used} de {max} usados hoje',
  'today.freeNoLimit': 'Sem limite diário',
  'today.freeAction': 'Novo registo livre',
  'today.freeLimitReached': 'Limite diário atingido. Pode voltar a registar amanhã.',
  'today.freeUnsupported': 'Tipo de resposta não suportado',

  'sync.sentTitle': 'Tudo enviado',
  'sync.sentBody':
    'Todos os seus registos já chegaram à equipa do estudo. Não há nada à espera de ser enviado neste telemóvel.',
  'sync.waitingTitle': 'À espera de envio',
  'sync.waitingBody':
    '{count} registos guardados neste telemóvel. São enviados quando houver ligação.',
  'sync.waitingNote': 'Não desinstale a app até lá.',
  'sync.failedTitle': 'Registos com problema',
  'sync.failedBody':
    '{failed} registos não puderam ser aceites e {waiting} continuam à espera de envio.',
  'sync.failedNote':
    'Abra o registo com problema para ver o estado. Se o problema continuar, contacte a equipa do estudo.',
  'sync.retry': 'Tentar enviar agora',
  'sync.retrying': 'A tentar enviar…',
  'sync.close': 'Fechar',

  'banner.close': 'Fechar',
  'notification.foregroundTitle': 'Novo pedido',
  'notification.foregroundBody': 'Há um novo pedido à sua espera. Toque para abrir.',
  'notification.open': 'Abrir',
  'notification.closedTitle': 'Pedido fechado',
  'notification.closedBody': 'Este pedido já fechou e não pode ser respondido.',
  'notification.unavailableTitle': 'Sem ligação',
  'notification.unavailableBody':
    'Não foi possível abrir o pedido agora. Tente outra vez com ligação.',

  'warning.count': '{count} avisos sobre esta atividade',
  'warning.countOne': '1 aviso sobre esta atividade',
  'warning.privacy':
    'Evite fotografar ou filmar pessoas que não estão no estudo, documentos e números de porta.',
  'warning.locationOnTitle': 'A localização será incluída porque esta atividade a pede.',
  'warning.locationOnBody':
    'Porquê? A equipa do estudo quer saber em que parte do jardim está. A localização só é recolhida quando guarda um registo desta atividade.',
  'warning.locationOffTitle': 'Esta atividade não pede localização.',
  'warning.locationOffBody': 'O registo não inclui o sítio onde está.',
  'warning.dismiss': 'Percebi',

  'record.loading': 'A carregar a atividade…',
  'record.requested': 'O que é pedido',
  'record.chooseType': 'Como quer responder?',
  'record.notFound': 'Atividade não encontrada.',
  'record.notFoundBody':
    'Este pedido já não está disponível neste telemóvel. Volte a Hoje e tente outra vez.',
  'record.unsupportedTitle': 'Este pedido não pode ser respondido nesta versão',
  'record.unsupportedBody':
    'A equipa pediu um tipo de resposta que esta versão da app ainda não sabe gravar.',
  'record.typeUnavailable': 'Esta atividade não aceita este tipo de resposta.',
  'record.save': 'Guardar registo',
  'record.saving': 'A guardar…',
  'record.saveError':
    'Não foi possível guardar o registo neste telemóvel. Tente outra vez.',
  'record.offlineNote': 'Sem rede, fica guardado no telemóvel e é enviado depois.',
  'record.noInstructions': 'Sem instruções adicionais.',

  'record.camera.permissionTitle': 'Precisa de dar acesso à câmara',
  'record.camera.permissionBody':
    'A câmara só é usada enquanto grava este registo. A permissão é pedida agora.',
  'record.camera.openCamera': 'Ativar câmara',
  'record.camera.openSettings': 'Abrir definições',
  'record.camera.error': 'Não foi possível abrir a câmara.',
  'record.microphone.permissionTitle': 'Precisa de dar acesso ao microfone',
  'record.microphone.permissionBody':
    'O microfone só é usado enquanto grava este registo. A permissão é pedida agora.',
  'record.microphone.openMicrophone': 'Ativar microfone',
  'record.microphone.openSettings': 'Abrir definições',
  'record.microphone.error': 'Não foi possível usar o microfone.',

  'record.photo.capturedAt': 'Captada às {time}',
  'record.photo.retake': 'Repetir a foto',
  'record.photo.shutter': 'Tirar foto',
  'record.photo.captureError': 'Não foi possível tirar a foto. Tente outra vez.',
  'record.photo.noteLabel': 'Uma frase sobre o momento',
  'record.photo.noteOptional': '(opcional)',
  'record.photo.notePlaceholder': 'Escreva uma frase curta',

  'record.text.label': 'A sua resposta',
  'record.text.placeholder': 'Escreva aqui a sua resposta',
  'record.text.toAudio': 'Gravar áudio em vez disso',

  'record.video.recording': 'A gravar',
  'record.video.limit': 'O vídeo pára sozinho ao fim de 1 minuto.',
  'record.video.stop': 'Parar a gravação',
  'record.video.stopSave': 'Parar e guardar',
  'record.video.discard': 'Descartar gravação',
  'record.video.recorded': 'Vídeo gravado',
  'record.video.duration': '{duration} de vídeo',
  'record.video.captureError': 'Não foi possível gravar o vídeo. Tente outra vez.',
  'record.video.start': 'Começar a gravar',
  'record.video.preview': 'Pré-visualização do vídeo',

  'record.audio.recording': 'A gravar',
  'record.audio.limit': 'A gravação pára sozinha ao fim de 1 minuto.',
  'record.audio.stopSave': 'Parar e guardar',
  'record.audio.stop': 'Parar a gravação',
  'record.audio.recorded': 'Gravação feita',
  'record.audio.duration': '{duration} de áudio',
  'record.audio.captureError': 'Não foi possível gravar o áudio. Tente outra vez.',
  'record.audio.start': 'Começar a gravar',
  'record.audio.toText': 'Escrever em vez disso',
  'record.audio.toAudio': 'Gravar áudio em vez disso',
  'record.audio.level': 'Nível do microfone',

  'scale.low': 'Muito mal',
  'scale.high': 'Muito bem',
  'scale.middle': 'Assim-assim',
  'scale.face.veryBad': 'Muito mal',
  'scale.face.bad': 'Mal',
  'scale.face.neutral': 'Assim-assim',
  'scale.face.good': 'Bem',
  'scale.face.veryGood': 'Muito bem',
  'scale.group': 'Escala de {count} pontos',
  'scale.optionLabel': '{value}, {label}',
  'scale.sliderGroup': 'Escala de 0 a 100',
  'scale.sliderLabel': 'Valor escolhido: {value} de 100',
  'scale.sliderHint': 'Deslize o dedo para escolher um valor entre 0 e 100.',

  'saved.title': 'Guardado no telemóvel',
  'saved.body': 'Será enviado quando houver rede.',
  'saved.waiting': '{count} registos à espera de rede',
  'saved.warning':
    'Enquanto não forem enviados, só existem neste telemóvel. Não desinstale a app até serem enviados.',
  'saved.note':
    'Quando houver rede, o registo passa a Enviado e mantém a hora a que o gravou.',
  'saved.sentTitle': 'Registo enviado',
  'saved.sentBody': 'O registo já chegou à equipa do estudo.',
  'saved.failedTitle': 'Registo guardado, mas com problema no envio',
  'saved.failedBody':
    'O registo está neste telemóvel, mas a equipa do estudo não o aceitou. Contacte a equipa do estudo.',
  'saved.seeEntries': 'Ver os meus registos',
  'saved.backToday': 'Voltar a Hoje',
  'saved.celebrationLabel': 'Registo guardado',

  'entries.title': 'Os meus registos',
  'entries.subtitle': '{count} registos · só de leitura',
  'entries.waitingTitle': '{count} registos à espera de rede',
  'entries.waitingBody':
    'Estão só neste telemóvel. Não desinstale a app até serem enviados.',
  'entries.group.attention': 'Precisa de atenção',
  'entries.group.today': 'Hoje',
  'entries.group.yesterday': 'Ontem',
  'entries.emptyTitle': 'Ainda não há registos',
  'entries.emptyBody':
    'Quando responder a um pedido, o registo aparece aqui e fica guardado neste telemóvel até chegar à equipa do estudo.',
  'entries.recordedAt': 'Gravado às {time}',
  'entries.recordedOn': 'Gravado {date}, {time}',
  'entries.recordedOnYesterday': 'Gravado ontem, {time}',
  'entries.failed': 'Este registo não pôde ser aceite. Contacte a equipa do estudo.',
  'entry.status.sent': 'Enviado',
  'entry.status.waiting': 'À espera de rede',
  'entry.status.failed': 'Problema no envio',

  'entry.kind': 'Registo · {type}',
  'entry.phrase': 'A sua frase',
  'entry.answer': 'A sua resposta',
  'entry.recording': 'A sua gravação',
  'entry.activity': 'Atividade',
  'entry.recorded': 'Gravado',
  'entry.received': 'Recebido',
  'entry.notReceived': 'Ainda não recebido',
  'entry.receivedToday': 'hoje, às {time}',
  'entry.receivedOn': '{date}, às {time}',
  'entry.lock': 'Os registos não podem ser alterados depois de enviados.',
  'entry.photoLabel': 'A sua fotografia',
  'entry.photoSent':
    'A fotografia foi enviada para a equipa do estudo. Já não está guardada neste telemóvel.',
  'entry.videoSent':
    'O vídeo foi enviado para a equipa do estudo. Já não está guardado neste telemóvel.',
  'entry.audioSent':
    'O áudio foi enviado para a equipa do estudo. Já não está guardado neste telemóvel.',
  'entry.scaleValue': '{value} de {max}',
  'entry.notFound': 'Registo não encontrado.',
  'entry.failedTitle': 'Problema no envio',
  'entry.failedBody':
    'A equipa do estudo não aceitou este registo. Contacte a equipa do estudo para saber o que fazer.',
  'entry.retryHint':
    'O registo continua guardado neste telemóvel e será tentado outra vez quando a ligação voltar.',

  'studies.title': 'Estudos',
  'studies.body':
    'Aqui vai poder ver os estudos em que participa e os pedidos de outros estudos.',
  'profile.title': 'As minhas horas',
  'profile.body':
    'Aqui vai poder ver a sua participação, a disponibilidade e as definições.',
} as const;

export type DailyTranslationKey = keyof typeof daily;

export { daily };
