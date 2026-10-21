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
  'today.title': 'Hoje',
  'today.date': 'sexta-feira, 9 de outubro',
  'today.syncSent': 'Estado do envio: tudo enviado',
  'today.syncWaiting': 'Estado do envio: sem rede, {count} registos à espera',
  'today.syncOpenHint': 'Abrir estado do envio',
  'today.requestAsked': 'Pedido às {time}',
  'today.requestMeta': '{types} · Demora cerca de {minutes} min',
  'today.closesAt': 'Fecha às {time}',
  'today.answerNow': 'Responder agora',
  'today.freeTitle': 'Registo livre',
  'today.freeUsed': '{used} de {cap} usados hoje',
  'today.freeCapped': 'Já fez os {cap} de hoje. Amanhã pode voltar a fazer.',
  'today.freeAvailable': 'Pode fazer até {cap} registos livres por dia.',
  'today.freeBody':
    'Quer registar um momento, um sítio ou algo que lhe chamou a atenção? Pode fazê-lo a qualquer hora, sem esperar por um pedido.',
  'today.newFreeEntry': 'Novo registo livre',
  'today.noRequestTitle': 'Não há pedidos em aberto',
  'today.nextRequest': 'O próximo chega entre as {from} e as {to}.',

  'sync.sentTitle': 'Tudo enviado',
  'sync.sentBody':
    'Todos os seus registos já chegaram à equipa do estudo. Não há nada à espera de ser enviado neste telemóvel.',
  'sync.waitingTitle': 'Sem rede',
  'sync.waitingBody': '{count} registos guardados neste telemóvel. São enviados quando houver rede.',
  'sync.waitingNote': 'Não desinstale a app até lá.',
  'sync.close': 'Fechar',

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

  'record.requested': 'O que é pedido',
  'record.chooseType': 'Como quer responder?',
  'record.notFound': 'Atividade não encontrada.',
  'record.save': 'Guardar registo',
  'record.offlineNote': 'Sem rede, fica guardado no telemóvel e é enviado depois.',

  'record.context.free': 'Registo livre',
  'record.context.request': 'Pedido das 14:15 · aberto até às 20:00',
  'record.context.quick': 'Um registo rápido',

  'record.photo.capturedAt': 'Captada às {time}',
  'record.photo.retake': 'Repetir a foto',
  'record.photo.cameraPlaceholder': 'Pré-visualização da câmara',
  'record.photo.shutter': 'Tirar foto',
  'record.photo.noteLabel': 'Uma frase sobre o momento',
  'record.photo.noteOptional': '(opcional)',
  'record.photo.notePlaceholder': 'Escreva uma frase curta',

  'record.text.label': 'A sua resposta',
  'record.text.placeholder': 'Escreva aqui a sua resposta',
  'record.text.toAudio': 'Gravar áudio em vez disso',

  'record.video.recording': 'A gravar',
  'record.video.timer': '0:48 / 2:00',
  'record.video.limit': 'O vídeo pára sozinho aos 2 minutos.',
  'record.video.stopSave': 'Parar e guardar',
  'record.video.discard': 'Descartar gravação',
  'record.video.preview': 'Pré-visualização do vídeo',

  'record.audio.recording': 'A gravar',
  'record.audio.elapsed': '0:23',
  'record.audio.total': '/ 1:00',
  'record.audio.limit': 'A gravação pára sozinha ao fim de 1 minuto.',
  'record.audio.stopSave': 'Parar e guardar',
  'record.audio.toText': 'Escrever em vez disso',
  'record.audio.toAudio': 'Gravar áudio em vez disso',

  'scale.low': 'Muito mal',
  'scale.high': 'Muito bem',
  'scale.face.veryBad': 'Muito mal',
  'scale.face.bad': 'Mal',
  'scale.face.neutral': 'Assim-assim',
  'scale.face.good': 'Bem',
  'scale.face.veryGood': 'Muito bem',
  'scale.group': 'Escala de {count} pontos',
  'scale.optionLabel': '{value}, {label}',

  'saved.title': 'Guardado no telemóvel',
  'saved.body': 'Será enviado quando houver rede.',
  'saved.waiting': '{count} registos à espera de rede',
  'saved.warning':
    'Enquanto não forem enviados, só existem neste telemóvel. Não desinstale a app até serem enviados.',
  'saved.note':
    'Quando houver rede, o registo passa a Enviado e mantém a hora a que o gravou.',
  'saved.seeEntries': 'Ver os meus registos',
  'saved.backToday': 'Voltar a Hoje',
  'saved.celebrationLabel': 'Registo guardado',

  'entries.title': 'Os meus registos',
  'entries.subtitle': '{count} registos · só de leitura',
  'entries.waitingTitle': '{count} registos à espera de rede',
  'entries.waitingBody':
    'Estão só neste telemóvel. Não desinstale a app até serem enviados.',
  'entries.group.attention': 'Precisa de atenção',
  'entries.group.today': 'Hoje, 9 out.',
  'entries.group.yesterday': 'Ontem, 8 out.',
  'entries.group.oct7': '7 out.',
  'entries.group.oct6': '6 out.',
  'entries.recordedAt': 'Gravado às {time}',
  'entries.recordedOn': 'Gravado {date}, {time}',
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
  'entry.location': 'Local',
  'entry.notReceived': 'Ainda não recebido',
  'entry.receivedToday': 'hoje, às {time}',
  'entry.receivedOn': '{date}, às {time}',
  'entry.lock': 'Os registos não podem ser alterados depois de enviados.',
  'entry.photoLabel': 'Fotografia do jardim, desenho de exemplo',
  'entry.scaleValue': '{value} de {max}',
  'entry.notFound': 'Registo não encontrado.',

  'entry.value.momentPhoto':
    'Muita gente à sombra. Os bancos junto ao lago estão todos ocupados.',
  'entry.value.momentText':
    'Vim ler um livro à sombra e acabei a falar com um vizinho sobre o jardim.',
  'entry.value.broughtAudio':
    'Nota de voz de 42 segundos sobre o que me trouxe ao jardim.',
  'entry.value.broughtText':
    'Vim ler um livro à sombra, como faço quase todas as sextas-feiras.',

  'activity.moment.title': 'Um momento no jardim',
  'activity.moment.instruction':
    'Fotografe ou descreva o sítio onde está agora no jardim e o que está a fazer.',
  'activity.brought.title': 'O que o trouxe ao jardim?',
  'activity.brought.instruction':
    'Conte em poucas palavras o que o trouxe hoje ao jardim. Pode gravar até 1 minuto de áudio ou escrever.',
  'activity.mood.title': 'Como se sente agora?',
  'activity.mood.instruction':
    'De 1 (muito mal) a 7 (muito bem), como se sente neste momento?',
  'activity.moodFaces.title': 'Como se sente agora?',
  'activity.moodFaces.instruction':
    'Escolha a cara que melhor descreve como se sente neste momento.',

  'studies.title': 'Estudos',
  'studies.body':
    'Aqui vai poder ver os estudos em que participa e os pedidos de outros estudos.',
  'profile.title': 'As minhas horas',
  'profile.body':
    'Aqui vai poder ver a sua participação, a disponibilidade e as definições.',
} as const;

export type DailyTranslationKey = keyof typeof daily;

export { daily };
