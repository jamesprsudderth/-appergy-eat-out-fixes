import { Platform } from "react-native";

const brandGreen = "#8bc66a";
const darkGreen = "#3d7a2e";

export const Colors = {
  light: {
    text: "#1a1a1a",
    textSecondary: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#999999",
    tabIconSelected: brandGreen,
    link: darkGreen,
    primary: brandGreen,
    primaryDark: darkGreen,
    accent: brandGreen,
    destructive: "#d32f2f",
    warning: "#ed6c02",
    backgroundRoot: "#f8f8f6",
    backgroundDefault: "#f8f8f6",
    backgroundSecondary: "#f0f0ee",
    backgroundTertiary: "#e8e8e6",
    divider: "#d1d5d2",
    surface: "#ffffff",
  },
  dark: {
    text: "#1a1a1a",
    textSecondary: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#999999",
    tabIconSelected: brandGreen,
    link: darkGreen,
    primary: brandGreen,
    primaryDark: darkGreen,
    accent: brandGreen,
    destructive: "#d32f2f",
    warning: "#ed6c02",
    backgroundRoot: "#f8f8f6",
    backgroundDefault: "#f8f8f6",
    backgroundSecondary: "#f0f0ee",
    backgroundTertiary: "#e8e8e6",
    divider: "#d1d5d2",
    surface: "#ffffff",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  sectionHeader: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 1,
  },
  footer: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
