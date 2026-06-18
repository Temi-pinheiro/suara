/**
 * Suara design tokens (from docs design pass — Kataku system, tuned warm).
 * One hue logic: TEAL = the live voice (speech, mic, progress, primary action).
 * Verdict warmths layer on top (green / amber / slate). No red in any role.
 *
 * Light + dark are the same component tree with swapped values; the scheme follows
 * the OS (useColorScheme) — there's no manual toggle because client storage is
 * disallowed (CLAUDE.md §6), so a preference couldn't persist anyway.
 */

import { useColorScheme } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

export interface Colors {
  bg: string;
  surface: string;
  cream: string;
  cream2: string;
  stroke: string;
  hair: string;
  text: string;
  dim: string;
  faint: string;
  narration: string;
  primary: string;
  onPrimary: string;
  live: string;
  wash: string;
  correct: string;
  close: string;
  off: string;
  wordmark: string;
}

const light: Colors = {
  bg: '#FAF8F3',
  surface: '#FFFFFF',
  cream: '#F2EEE4',
  cream2: '#EAE3D4',
  stroke: '#E4DCCB',
  hair: '#EDE7D9',
  text: '#2A261F',
  dim: '#5C564A',
  faint: '#8E8678',
  narration: '#3A352C',
  primary: '#0F8E78',
  onPrimary: '#FFFFFF',
  live: '#0E9E84',
  wash: '#DCEFE9',
  correct: '#1F9D62',
  close: '#B0741B',
  off: '#5D7187',
  wordmark: '#B6AFA0',
};

const dark: Colors = {
  bg: '#0F1411',
  surface: '#18201B',
  cream: '#212B24',
  cream2: '#283328',
  stroke: '#2D3A30',
  hair: '#232E26',
  text: '#F1F5EF',
  dim: '#9DAB9E',
  faint: '#5F6E62',
  narration: '#AEBBAD',
  primary: '#45D4B0',
  onPrimary: '#07140F',
  live: '#5FE0BE',
  wash: '#143029',
  correct: '#45D483',
  close: '#E3A968',
  off: '#94A3B8',
  wordmark: '#6E7B6E',
};

export type Scheme = 'light' | 'dark';

/** Theme-independent scales. */
export const space = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, xxl: 20, h: 26, hero: 30 } as const;
export const radius = {
  word: 24,
  feedback: 20,
  cue: 16,
  picker: 22,
  pill: 999,
  button: 18,
  chip: 999,
} as const;

/** Type scale (RN lineHeight is absolute px, so it's precomputed from the ratio). */
export const type = {
  word: { fontSize: 76, fontWeight: '700', lineHeight: 76, letterSpacing: -1 },
  roman: { fontSize: 26, fontWeight: '500', lineHeight: 29, letterSpacing: 0.3 },
  gloss: { fontSize: 16, fontWeight: '400' },
  setup: { fontSize: 23, fontWeight: '500', lineHeight: 31, letterSpacing: -0.2 },
  cue: { fontSize: 17, fontWeight: '500', lineHeight: 24 },
  narration: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 25 },
  verdict: { fontSize: 15, fontWeight: '700' },
  button: { fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  helper: { fontSize: 14, fontWeight: '400' },
  msg: { fontSize: 19, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

/** Shadows depend on the scheme (and some on accent color). */
export function shadows(c: Colors, scheme: Scheme) {
  const dk = scheme === 'dark';
  const base = dk ? '#000000' : '#2A261F';
  return {
    card: {
      shadowColor: base,
      shadowOpacity: dk ? 0.34 : 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    lift: {
      shadowColor: base,
      shadowOpacity: dk ? 0.5 : 0.12,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 18 },
      elevation: 6,
    },
    mic: {
      shadowColor: c.primary,
      shadowOpacity: dk ? 0.3 : 0.34,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    glowLive: {
      shadowColor: c.live,
      shadowOpacity: dk ? 0.4 : 0.42,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  } satisfies Record<string, ViewStyle>;
}

export interface Theme {
  c: Colors;
  scheme: Scheme;
  shadow: ReturnType<typeof shadows>;
}

/** The single theme hook — follows the OS color scheme. */
export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = scheme === 'dark' ? dark : light;
  return { c, scheme, shadow: shadows(c, scheme) };
}
