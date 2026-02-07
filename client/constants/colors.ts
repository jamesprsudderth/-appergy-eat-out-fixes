/**
 * Appergy Color System
 *
 * Brand green: #8bc66a (from app icon)
 * Dark green:  #3d7a2e (for white-text-on-green buttons — passes WCAG AA)
 *
 * Primary source of truth for all colors in the app.
 * Every screen and component should import from here — no hardcoded hex values.
 */

export const AppColors = {
  // ── Brand ──
  primary: "#8bc66a",
  primaryDark: "#3d7a2e",
  primaryLight: "#8bc66a30",
  accent: "#8bc66a",

  // ── Text ──
  text: "#1a1a1a",
  secondaryText: "#666666",
  buttonText: "#FFFFFF",

  // ── Status ──
  success: "#2e7d32",
  warning: "#ed6c02",
  destructive: "#d32f2f",
  info: "#5B7FCC",

  // ── Backgrounds ──
  background: "#f8f8f6",
  backgroundSecondary: "#f0f0ee",
  backgroundTertiary: "#e8e8e6",

  // ── Surfaces ──
  surface: "#ffffff",
  surfaceSecondary: "#f0f0ee",
  divider: "#d1d5d2",

  // ── Tab bar ──
  tabBar: "#1a1a1a",
  tabIconDefault: "#999999",
  tabIconSelected: "#8bc66a",

  // ── Links ──
  link: "#3d7a2e",
} as const;

export type AppColorKey = keyof typeof AppColors;
