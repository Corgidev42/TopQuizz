export const themes = {
  default: {
    name: "MasterQuizz",
    primary: "#F97316",
    primaryLight: "#FB923C",
    primaryDark: "#EA580C",
    bg: "#0A0A0A",
    surface: "#1A1A1A",
    surfaceLight: "#2A2A2A",
    text: "#FAFAFA",
    textMuted: "#A3A3A3",
  },
  neon: {
    name: "Neon Night",
    primary: "#00FF88",
    primaryLight: "#33FF99",
    primaryDark: "#00CC66",
    bg: "#0D0D1A",
    surface: "#1A1A2E",
    surfaceLight: "#2A2A3E",
    text: "#FAFAFA",
    textMuted: "#8888AA",
  },
  ocean: {
    name: "Ocean",
    primary: "#0EA5E9",
    primaryLight: "#38BDF8",
    primaryDark: "#0284C7",
    bg: "#0C1222",
    surface: "#162032",
    surfaceLight: "#1E2D42",
    text: "#FAFAFA",
    textMuted: "#94A3B8",
  },
} as const;

export type ThemeName = keyof typeof themes;
