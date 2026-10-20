import type { TextStyle } from 'react-native';

export const colors = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  text: '#1B2436',
  textBody: '#3A4357',
  textMuted: '#5B6478',
  primary: '#2F5BEA',
  primaryDark: '#1E3FB0',
  primarySoft: '#EAF0FF',
  border: '#DCE1EC',
  divider: '#E3E7F0',
  accent: '#FFB020',
  disabledBackground: '#EEF1F6',
  disabledText: '#5B6478',
  successBackground: '#E3F4EC',
  successText: '#0B5C40',
  overlay: 'rgba(19, 26, 42, 0.55)',
  white: '#FFFFFF',
  scanBackground: '#0E1512',
  scanBackgroundDeep: '#17231D',
  scanSurface: '#1F2F25',
  scanHighlight: '#25382C',
  scanOutline: 'rgba(255, 255, 255, 0.4)',
  scanPill: 'rgba(255, 255, 255, 0.14)',
  scanTextMuted: '#D5DCE8',
  scanBorder: 'rgba(255, 255, 255, 0.7)',
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  card: 20,
  hero: 24,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
  },
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
  },
  subheading: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
  },
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 27,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
  },
  labelSmall: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  micro: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 2.2,
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.84,
  },
} satisfies Record<string, TextStyle>;
