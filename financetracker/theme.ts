import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeMode, useFinanceStore } from "./lib/store";

type Colors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  text: string;
  textMuted: string;
  success: string;
  danger: string;
  border: string;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

const darkColors: Colors = {
  background: "#050608",
  surface: "#10121B",
  surfaceElevated: "#161A26",
  primary: "#3B82F6",
  primaryMuted: "#2563EB",
  accent: "#60A5FA",
  text: "#F8FAFF",
  textMuted: "#94A3B8",
  success: "#34D399",
  danger: "#FB7185",
  border: "#1F2937",
};

const lightColors: Colors = {
  background: "#F8FAFF",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF3FF",
  primary: "#2563EB",
  primaryMuted: "#1D4ED8",
  accent: "#60A5FA",
  text: "#0F172A",
  textMuted: "#475569",
  success: "#047857",
  danger: "#B91C1C",
  border: "#CBD5F5",
};

const buildTypography = (colors: Colors) => ({
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
    color: colors.text,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1.8,
  },
});

const buildComponents = (colors: Colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonPrimaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  buttonSecondary: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
});

const buildTheme = (mode: ThemeMode) => {
  const colors = mode === "light" ? lightColors : darkColors;
  return {
    colors,
    spacing,
    radii,
    typography: buildTypography(colors),
    components: buildComponents(colors),
  } as const;
};

const themeMap = {
  light: buildTheme("light"),
  dark: buildTheme("dark"),
} as const satisfies Record<ThemeMode, ReturnType<typeof buildTheme>>;

export type Theme = (typeof themeMap)[keyof typeof themeMap];

export const useAppTheme = (): Theme => {
  const mode = useFinanceStore((state) => state.preferences.themeMode);
  return useMemo(() => themeMap[mode], [mode]);
};

export const useThemedStyles = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T,
): T => {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
};

export const getThemeForMode = (mode: ThemeMode): Theme => themeMap[mode];
