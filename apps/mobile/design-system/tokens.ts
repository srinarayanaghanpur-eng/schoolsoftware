/**
 * Design tokens — single source of truth for all mobile UI.
 * Derived from the approved "Parent App.dc.html" design (Material 3, light).
 *
 * RULES (enforced in review):
 *  - No raw hex/rgb literals anywhere outside this file.
 *  - No StyleSheet.create outside design-system/.
 *  - Never set allowFontScaling={false}; typography respects OS settings.
 */

export const color = {
  // Surfaces
  background: "#faf9fd",
  previewBackdrop: "#e9e7ef",
  surface: "#ffffff",
  surfaceVariant: "#f1f0f7",
  outline: "#eceaf2",
  outlineStrong: "#e4e2ec",

  // Primary (indigo)
  primary: "#4356a9",
  primaryDeep: "#2d3f8f",
  primaryContainer: "#dde1ff",
  onPrimaryContainer: "#00174b",
  primaryGradientA: "#3c4d9e",
  primaryGradientB: "#4a5fc0",

  // Text
  ink: "#1a1b22",
  ink2: "#46464f",
  ink3: "#6f6f7a",
  muted: "#8a8a94",
  faint: "#c7c6d2",
  onPrimary: "#ffffff",

  // Semantic
  success: "#2e6b32",
  successContainer: "#d3f0d0",
  onSuccessContainer: "#0c2010",
  warning: "#7a5900",
  warningContainer: "#ffe089",
  warningSurface: "#fff3d6",
  onWarningDeep: "#4d3b00",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onErrorContainer: "#410002",

  // Misc accents seen in the design
  accountPurple: "#7a4988",
  inverseSurface: "#2c2c35",
  inverseAccent: "#83d5c6"
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
  pill: 100,
  circle: 999
} as const;

export const type = {
  display: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.4, color: color.ink },
  title: { fontSize: 16, fontWeight: "600" as const, color: color.ink },
  body: { fontSize: 14, fontWeight: "400" as const, color: color.ink, lineHeight: 20 },
  bodyMedium: { fontSize: 13.5, fontWeight: "600" as const, color: color.ink },
  label: { fontSize: 12, fontWeight: "400" as const, color: color.muted },
  overline: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, color: color.ink3 },
  caption: { fontSize: 11.5, fontWeight: "400" as const, color: color.muted },
  navLabel: { fontSize: 11, color: color.ink2 }
} as const;

export const elevation = {
  card: {
    shadowColor: color.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  hero: {
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 6
  },
  toast: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8
  }
} as const;

export const motion = {
  pressScale: 0.96,
  sheetDuration: 280,
  toastDuration: 2600
} as const;
