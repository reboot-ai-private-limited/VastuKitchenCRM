// Tokens copied from apps/web/app/globals.css (see docs/mobile/02-design-system.md). No raw hex outside this file.
export const colors = {
  background: '#ffffff',
  foreground: '#0f1c1a',
  card: '#ffffff',
  primary: '#0e8f78',
  primaryPressed: '#0b7563',
  primarySoft: '#e4f5f0',
  primaryForeground: '#ffffff',
  muted: '#f0f5f4',
  mutedForeground: '#566865',
  border: '#dce6e3',
  input: '#cbd8d4',
  destructive: '#c0392b',
  destructiveSoft: '#fbe9e7',
  placeholder: '#9a8b7e',
  backdrop: 'rgba(15, 28, 26, 0.42)',
} as const;

export const tone = {
  info: { fg: '#1d5fa8', bg: '#e8f1fb' },
  success: { fg: '#1e7a46', bg: '#e7f5ec' },
  warning: { fg: '#9a6200', bg: '#fdf3dc' },
  danger: { fg: '#b3261e', bg: '#fbe9e7' },
  neutral: { fg: '#4a5b58', bg: '#edf2f1' },
  violet: { fg: '#5b3fa6', bg: '#efeafb' },
  orange: { fg: '#a24a10', bg: '#fcebdd' },
  accent: { fg: '#0b7563', bg: '#e4f5f0' },
} as const;
export type Tone = keyof typeof tone;

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, '2xl': 18, '3xl': 22, full: 9999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const hit = 48;
export const control = { sm: 48, md: 48, lg: 52 } as const;

export const shadow = {
  card: {
    shadowColor: '#0f2823',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#0f2823',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const type = {
  title: { fontSize: 22, lineHeight: 30, fontFamily: font.semibold, letterSpacing: -0.3 },
  section: { fontSize: 16, lineHeight: 24, fontFamily: font.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: font.regular },
  label: { fontSize: 15, lineHeight: 22, fontFamily: font.medium },
  caption: { fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  counter: { fontSize: 26, lineHeight: 36, fontFamily: font.semibold },
} as const;
