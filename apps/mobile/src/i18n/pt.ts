const pt = {
  'common.back': 'Voltar',
  'common.continue': 'Continuar',

  'welcome.brand': 'Fieldnote',
  'welcome.language': 'Idioma',
  'welcome.portuguese': 'Português',
  'welcome.english': 'English',
  'welcome.title': 'Boas-vindas ao Fieldnote',
  'welcome.body':
    'Participe num estudo de investigação e registe o seu dia a dia no telemóvel. Entre com o convite da equipa do estudo ou receba convites através da bolsa de voluntários.',
  'welcome.previewLabel':
    'Exemplo de convite enviado pela equipa do estudo, com um código escondido',
  'welcome.previewTeam': 'Equipa do estudo',
  'welcome.previewCode': 'XXXX-XXXX-XXXX',
  'welcome.scanQr': 'Ler código QR',
  'welcome.writeCode': 'Escrever o código',
  'welcome.poolTitle': 'Bolsa de voluntários',
  'welcome.poolBody': 'Receba convites para estudos perto de si',
  'welcome.alreadyHaveAccount': 'Já tenho conta',

  'scan.title': 'Ler código QR',
  'scan.instruction': 'Aponte a câmara ao código QR do convite',
  'scan.reading': 'A ler o código',
  'scan.cameraPlaceholder': 'Pré-visualização da câmara',
  'scan.note': 'A câmara só serve para ler o código do convite.',

  'code.title': 'Escrever o código',
  'code.body':
    'Escreva o código que a equipa do estudo lhe enviou. Não precisa de criar conta, nem de dar o seu e-mail.',
  'code.label': 'Código de convite',
  'code.placeholder': 'XXXX-XXXX-XXXX',
  'code.help':
    'O código pessoal tem 12 letras e números, vale 7 dias e só pode ser usado uma vez. O de um cartaz tem 8.',
  'code.info':
    'Precisa de ligação à internet para entrar. Ainda não tem código? Peça-o à equipa do estudo.',

  'invitation.title': 'Foi convidado para participar num estudo',
  'invitation.teamLabel': 'Equipa',
  'invitation.durationLabel': 'Duração',
  'invitation.requestsLabel': 'Pedidos',
  'invitation.recordsLabel': 'O que regista',
  'invitation.locationLabel': 'Localização',
  'invitation.accept': 'Quero participar',
  'invitation.decline': 'Não quero participar',
} as const;

export type TranslationKey = keyof typeof pt;

export function t(key: TranslationKey): string {
  return pt[key];
}
