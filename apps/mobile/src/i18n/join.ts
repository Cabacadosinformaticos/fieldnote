const join = {
  'step.accessibility': 'Passo {step} de {total}',

  'consent.step': 'Passo 2 de 4 · Consentimento',
  'consent.title': 'Consentimento informado',
  'consent.subtitle': '{title} · versão {version} · Português',
  'consent.subtitleEmpty': 'Consentimento informado · Português',
  'consent.readFull': 'Ler o texto completo',
  'consent.scrollLabel': 'Texto do consentimento, deslize para ler tudo',
  'consent.footerNote': 'Guardamos a versão do texto e o momento em que aceitou.',
  'consent.accept': 'Aceito participar',
  'consent.decline': 'Não aceito',
  'consent.declineTitle': 'Não aceitar o consentimento?',
  'consent.declineBody':
    'Sem o seu consentimento, não lhe enviamos nenhum pedido nem recolhemos nenhum dado. Pode ler o texto outra vez ou sair do estudo.',
  'consent.declineBack': 'Voltar ao texto',
  'consent.declineLeave': 'Sair do estudo',

  'consent.objective.title': 'Objetivo',
  'consent.requests.title': 'O que lhe vamos pedir',
  'consent.location.title': 'Localização',
  'consent.contact.title': 'Contacto',
  'consent.fallback.aboutBody': 'Consentimento informado do estudo «{title}».',
  'consent.fallback.period': 'Duração do estudo: {period}.',
  'consent.fallback.recorded': 'O que regista: {types}.',
  'consent.fallback.locationYes':
    'A localização é recolhida apenas nas atividades que a pedem.',
  'consent.fallback.locationNo': 'A localização não é recolhida neste estudo.',
  'consent.fallback.team': 'Equipa: {team}.',
  'consent.closing':
    'Ao tocar em «Aceito participar», confirma que leu e compreendeu este texto e que aceita participar. Guardamos a versão do texto e o momento em que aceitou.',

  'questions.step': 'Passo 2 de 4 · Perguntas do estudo',
  'questions.title': 'Algumas perguntas da equipa',
  'questions.study': '{title}',
  'questions.body':
    'Ajudam a equipa a perceber as respostas. Ficam ligadas ao seu pseudónimo, não ao seu nome.',
  'questions.count': '{answered} de {total} respondidas',
  'questions.optionalNote': 'Pode deixar perguntas por responder.',
  'questions.hintSingle': 'Escolha uma resposta.',
  'questions.hintMultiple': 'Pode escolher mais do que uma.',
  'questions.hintYesNo': 'Escolha uma resposta.',
  'questions.hintShort': 'Resposta curta, até 300 caracteres.',
  'questions.shortPlaceholder': 'Escreva a sua resposta',
  'questions.yes': 'Sim',
  'questions.no': 'Não',

  'availability.step': 'Passo 3 de 4 · As suas horas',
  'availability.title': 'Em que horas pode receber pedidos?',
  'availability.body':
    'O estudo nunca lhe pede nada fora destas horas. Não lhe mostramos antes a que horas chegam os pedidos, para que as respostas sejam espontâneas.',
  'availability.any': 'Qualquer altura',
  'availability.anyBody':
    'Com esta opção, os pedidos chegam em qualquer altura, dentro das horas do estudo.',
  'availability.empty': 'Ainda não tem nenhum intervalo. Adicione um abaixo.',
  'availability.range': '{from} às {to}',
  'availability.editRange': 'Alterar o intervalo {range}',
  'availability.removeRange': 'Remover o intervalo {range}',
  'availability.quickLabel': 'Adicionar já feito',
  'availability.quickMorning': 'Manhã',
  'availability.quickAfternoon': 'Tarde',
  'availability.quickEvening': 'Noite',
  'availability.addQuick': 'Adicionar {label}, {range}',
  'availability.addInterval': 'Adicionar intervalo',
  'availability.dailyNote':
    'Este estudo faz até {count} pedidos por dia. Quanto mais horas deixar, mais fácil é distribuí-los.',
  'availability.dailyNoteOne':
    'Este estudo faz 1 pedido por dia. Quanto mais horas deixar, mais fácil é distribuí-lo.',
  'availability.dailyNoteUnknown':
    'Este estudo envia-lhe pedidos ao longo do dia. Quanto mais horas deixar, mais fácil é distribuí-los.',
  'availability.caption':
    'Pode mudar estas horas quando quiser, no separador Horas. As alterações valem a partir do próximo pedido planeado.',
  'availability.sheetNew': 'Novo intervalo',
  'availability.sheetEdit': 'Alterar o intervalo',
  'availability.closeSheet': 'Fechar sem guardar',
  'availability.start': 'Início',
  'availability.end': 'Fim',
  'availability.weekdays': 'Dias da semana',
  'availability.save': 'Guardar intervalo',
  'availability.saving': 'A guardar…',
  'availability.invalidInterval': 'O início tem de ser antes do fim.',
  'availability.emptyError':
    'Adicione pelo menos um intervalo ou escolha «Qualquer altura».',
  'availability.noDays': 'Escolha pelo menos um dia em cada intervalo.',
  'availability.daysEvery': 'Todos os dias',
  'availability.daysWeekdays': 'De segunda a sexta',
  'availability.daysWeekend': 'Sábado e domingo',
  'availability.daysNone': 'Nenhum dia escolhido',
  'weekday.mon': 'Seg',
  'weekday.tue': 'Ter',
  'weekday.wed': 'Qua',
  'weekday.thu': 'Qui',
  'weekday.fri': 'Sex',
  'weekday.sat': 'Sáb',
  'weekday.sun': 'Dom',
  'weekday.monFull': 'segunda-feira',
  'weekday.tueFull': 'terça-feira',
  'weekday.wedFull': 'quarta-feira',
  'weekday.thuFull': 'quinta-feira',
  'weekday.friFull': 'sexta-feira',
  'weekday.satFull': 'sábado',
  'weekday.sunFull': 'domingo',

  'waiting.title': 'À espera da confirmação da equipa',
  'waiting.body':
    'A equipa do estudo vai confirmar a sua entrada. Receberá um aviso.',
  'waiting.studyLabel': 'Estudo',
  'waiting.studyTitle': '{title}',
  'waiting.entryNote': 'Entrada {kind} pedida a {date}',
  'waiting.entryNoteDate': 'Entrada pedida a {date}',
  'waiting.kindStudy': 'pelo cartaz do estudo',
  'waiting.kindPersonal': 'por código pessoal',
  'waiting.offline': 'Sem ligação. Voltamos a tentar.',
  'waiting.noToken':
    'Este telemóvel não guardou a chave desta participação. Peça à equipa do estudo para confirmar a entrada.',
  'waiting.declinedTitle': 'A equipa não aceitou a sua entrada',
  'waiting.declinedBody':
    'Não fica nenhum registo seu neste estudo. Pode fechar a app.',
  'waiting.nextTitle': 'O que acontece a seguir',
  'waiting.acceptTitle': 'Se a equipa aceitar',
  'waiting.acceptBody':
    'Recebe um aviso e os pedidos começam a chegar ao telemóvel.',
  'waiting.declineTitle': 'Se a equipa recusar',
  'waiting.declineBody': 'É informado de forma clara e nada fica registado.',
  'waiting.untilTitle': 'Até lá',
  'waiting.untilBody':
    'Nenhum pedido é enviado e a equipa não vê nenhum registo seu.',
  'waiting.note':
    'Já fez o que lhe cabia: o consentimento, as horas e os avisos ficam guardados neste telemóvel. Pode fechar a app.',
  'waiting.openStudies': 'Ver os meus estudos',

  'study.title': '{title}',
  'study.period': '{period}',
  'study.teamLabel': 'Equipa',
  'study.team': '{team}',
  'code.note': 'O código que leu não foi usado e continua válido.',

  'already.title': 'Já participa neste estudo',
  'already.body':
    'Este telemóvel já está neste estudo, por isso não precisa de entrar outra vez.',
  'already.enteredLabel': 'Entrou neste estudo',
  'already.entered': '{date}',
  'already.enteredUnknown': 'Data não disponível',
  'already.open': 'Abrir o estudo',
  'already.backHome': 'Voltar ao início',

  'return.title': 'Saiu deste estudo a {date}. Quer voltar?',
  'return.titleUnknown': 'Saiu deste estudo. Quer voltar?',
  'return.info':
    'Volta com o mesmo pseudónimo e os registos que já tinha. Os pedidos recomeçam a partir do plano da noite.',
  'return.confirm': 'Voltar ao estudo',
  'return.confirming': 'A voltar…',
  'return.decline': 'Agora não',

  'invitation.teamEmpty': 'Equipa do estudo',
  'invitation.requestsValue': 'Até {count} pedidos por dia, cerca de {minutes} min por dia',
  'invitation.requestsValueOne': 'Até 1 pedido por dia, cerca de {minutes} min por dia',
  'invitation.locationValue': 'Só em algumas atividades, que o indicam',
  'invitation.locationNone': 'Não é recolhida',
  'invitation.studyCodeNote': 'Entrada pelo cartaz do estudo.',
  'invitation.loading': 'A ler o convite…',
  'invitation.loadErrorTitle': 'Não foi possível abrir o convite',
  'invitation.retry': 'Tentar outra vez',
  'invitation.later': 'Decidir mais tarde',
  'invitation.laterTitle': 'Convite guardado',
  'invitation.laterBody':
    'O convite continua válido. Guardámos o código neste telemóvel e voltamos a preenchê-lo em «Escrever o código».',
  'invitation.laterOk': 'Entendido',
  'invitation.declineTitle': 'Não participar neste estudo?',
  'invitation.declineBodyPersonal':
    'Nada fica registado e nenhum pedido lhe é enviado. Se mudar de ideias, peça um novo código à equipa do estudo.',
  'invitation.declineBodyPoster':
    'Nada fica registado e nenhum pedido lhe é enviado. A equipa do estudo não é informada. Se mudar de ideias, volte a ler o código do cartaz.',
  'invitation.declineConfirm': 'Não participar',
  'invitation.declineBack': 'Voltar ao convite',

  'entryType.text': 'texto',
  'entryType.photo': 'fotos',
  'entryType.video': 'vídeo',
  'entryType.audio': 'áudio',
  'entryType.scale': 'uma escala de 1 a 7',
  'entryType.choice': 'escolhas',
  'entryType.empty': 'Ainda não definido',

  'date.unknown': 'Datas a anunciar',
  'date.periodSameMonth': '{from} a {to} {month} {year} ({days} dias)',
  'date.periodSameYear': '{fromDay} {fromMonth} a {toDay} {toMonth} {year} ({days} dias)',
  'date.periodFull': '{from} a {to} ({days} dias)',

  'scan.permissionTitle': 'Precisamos da câmara para ler o código',
  'scan.permissionBody':
    'A câmara só serve para ler o código QR do convite. Não guardamos nenhuma imagem.',
  'scan.enableCamera': 'Ativar câmara',
  'scan.permissionDenied':
    'Sem acesso à câmara não conseguimos ler o código. Pode escrevê-lo ou abrir as definições.',
  'scan.openSettings': 'Abrir definições',
  'scan.cameraUnavailable':
    'Não foi possível abrir a câmara neste telemóvel. Escreva o código.',
  'scan.invalid':
    'Não reconhecemos um código de convite neste QR. Tente outra vez ou escreva o código.',

  'joinAccount.title': 'Este código pede uma conta',
  'joinAccount.body':
    'Para entrar neste estudo com este código, precisa de uma conta Fieldnote. A conta permite recuperar os estudos num telemóvel novo e evita que a mesma pessoa entre com vários telemóveis. A equipa do estudo nunca vê a sua conta.',
  'joinAccount.create': 'Criar conta',
  'joinAccount.restore': 'Já tenho conta',
  'joinAccount.continue': 'Já criei a conta',
  'joinAccount.hint':
    'Depois de criar ou recuperar a conta, volte a este convite para continuar.',
  'joinAccount.missing':
    'Ainda não há uma conta neste telemóvel. Crie uma ou entre numa que já tenha.',
  'joinAccount.study': 'Estudo: {title}',

  'error.network':
    'Não foi possível ligar-nos. Verifique a ligação à internet e tente outra vez.',
  'error.generic': 'Não foi possível concluir o pedido. Tente outra vez.',
  'error.invalidCode': 'O código não é válido ou já não está disponível.',
  'error.invalidStudyAnswer':
    'Uma das respostas não é válida. Volte às perguntas e confirme.',
  'error.invalidAvailability':
    'Diga pelo menos um intervalo válido ou escolha «Qualquer altura».',
  'error.accountRequired':
    'Este código exige uma conta Fieldnote. Crie uma conta ou entre na sua e tente outra vez.',
  'error.participationRemoved':
    'A equipa removeu esta participação. Fale com a equipa do estudo.',
  'error.erasureScheduled':
    'Os seus dados deste estudo estão a ser apagados e não é possível voltar a entrar.',
  'error.entryDeclined': 'A equipa não aceitou a entrada neste estudo.',
} as const;

export type JoinKey = keyof typeof join;

export { join };
