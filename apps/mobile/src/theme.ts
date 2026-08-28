// ── Named color palette (design system scales) ───────────────────────────────
export const Palette = {
  graphite: {
    50:  '#F7F7F6', 100: '#EFEFEC', 200: '#DEDED8', 300: '#BEBEB5',
    400: '#9E9E95', 500: '#75756E', 600: '#58584B', 700: '#3D3D33',
    800: '#28281F', 900: '#17170F',
  },
  greenfield: {
    50:  '#EDFCF2', 100: '#D3F9DF', 200: '#A9F0C0', 300: '#6FE09A',
    400: '#3DC974', 500: '#18B055', 600: '#0D9143', 700: '#0A7236',
    800: '#095929', 900: '#064A21',
  },
  tangerine: {
    50:  '#FFF5ED', 100: '#FFE8D3', 200: '#FFCCA5', 300: '#FFA66D',
    400: '#FF7535', 500: '#FF5011', 600: '#E53407', 700: '#BE2408',
    800: '#97200F', 900: '#7A1D10',
  },
  sun: {
    50:  '#FFFCEB', 100: '#FFF6C7', 200: '#FFEA8B', 300: '#FFD84E',
    400: '#FFC520', 500: '#EFA400', 600: '#C97D00', 700: '#A15900',
    800: '#854500', 900: '#713700',
  },
  azure: {
    50:  '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
    400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
    800: '#1E40AF', 900: '#1E3A8A',
  },
  ruby: {
    50:  '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 300: '#FDA4AF',
    400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C',
    800: '#9F1239', 900: '#881337',
  },
} as const

// ── Font families (Plus Jakarta Sans) ────────────────────────────────────────
export const F = {
  regular:   'PlusJakartaSans_400Regular',
  medium:    'PlusJakartaSans_500Medium',
  semibold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  black:     'PlusJakartaSans_800ExtraBold', // no 900 in PJS, use 800
}

// ── Typography scale (from design system spec) ────────────────────────────────
export const T = {
  h1:             { fontSize: 36, lineHeight: 36 * 1.3,  fontFamily: 'PlusJakartaSans_700Bold'      },
  h2:             { fontSize: 32, lineHeight: 32 * 1.5,  fontFamily: 'PlusJakartaSans_700Bold'      },
  h3:             { fontSize: 24, lineHeight: 24 * 1.5,  fontFamily: 'PlusJakartaSans_700Bold'      },
  h4:             { fontSize: 18, lineHeight: 18 * 1.5,  fontFamily: 'PlusJakartaSans_600SemiBold'  },
  h5:             { fontSize: 18, lineHeight: 18 * 1.5,  fontFamily: 'PlusJakartaSans_500Medium'    },
  bodyDefault:    { fontSize: 16, lineHeight: 16 * 1.5,  fontFamily: 'PlusJakartaSans_400Regular'   },
  bodySmall:      { fontSize: 14, lineHeight: 14 * 1.3,  fontFamily: 'PlusJakartaSans_400Regular'   },
  captionDefault: { fontSize: 12, lineHeight: 12 * 1.3,  fontFamily: 'PlusJakartaSans_400Regular'   },
  captionSmall:   { fontSize: 10, lineHeight: 10 * 1.3,  fontFamily: 'PlusJakartaSans_400Regular'   },
}

// ── Legacy dark tokens (kept for backward-compat with auth screens) ──────────
export const D = {
  bg:          '#0B0B10',
  surface:     '#13131A',
  border:      '#242438',
  borderSub:   '#1A1A26',
  input:       '#0E0E16',
  inputBorder: '#28283E',
  textHead:    '#F2F2FA',
  textSub:     '#8C8CA8',
  textMuted:   '#3C3C58',
}

// ── Legacy light tokens ───────────────────────────────────────────────────────
export const C = {
  bg:        '#F4F5F8',
  surface:   '#FFFFFF',
  border:    '#E8E8F0',
  textHead:  '#0D0D18',
  textBody:  '#585872',
  textMuted: '#A0A0BC',
  error:     '#EF4444',
}
