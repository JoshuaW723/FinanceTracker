export const colors = {
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

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const typography = {
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
};

export const components = {
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
};

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  components,
};

export type Theme = typeof theme;
