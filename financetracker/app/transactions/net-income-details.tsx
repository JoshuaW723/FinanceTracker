import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount } from "../../lib/transactions";

dayjs.extend(isoWeek);

type PeriodParam = { period?: string; accountId?: string };

type WeeklySummary = {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  label: string;
  income: number;
  expense: number;
  net: number;
};

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) => {
  const maxDigits =
    options?.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : Number.isInteger(value)
        ? 0
        : 2;
  const minDigits =
    options?.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : Number.isInteger(value)
        ? 0
        : Math.min(2, maxDigits);

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    ...options,
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  }).format(value);
};

const buildWeeksForMonth = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const weeks: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
  let cursor = start.startOf("isoWeek");

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const weekStart = cursor.startOf("isoWeek");
    const weekEnd = cursor.endOf("isoWeek");

    weeks.push({
      start: weekStart.isBefore(start) ? start.startOf("day") : weekStart.startOf("day"),
      end: weekEnd.isAfter(end) ? end.endOf("day") : weekEnd.endOf("day"),
    });

    cursor = cursor.add(1, "week");
  }

  return weeks;
};

export default function NetIncomeDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { period: periodParam, accountId } = useLocalSearchParams<PeriodParam>();
  const periodScrollerRef = useRef<ScrollView | null>(null);

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const baseCurrency = currency || "USD";
  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.excludeFromTotal && (account.currency || baseCurrency) === baseCurrency,
      ),
    [accounts, baseCurrency],
  );

  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);

  const [selectedAccountId] = useState<string | null>(() =>
    typeof accountId === "string" && accountId.length ? accountId : null,
  );

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    const fallbackIndex = Math.max(periodOptions.length - 1, 0);
    return periodOptions.find((option) => option.key === key) ?? periodOptions[fallbackIndex];
  }, [periodOptions, periodParam]);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(() => resolvedPeriod.key);

  const selectedPeriod = useMemo(
    () => periodOptions.find((option) => option.key === selectedPeriodKey) ?? resolvedPeriod,
    [periodOptions, resolvedPeriod, selectedPeriodKey],
  );

  const { start, end } = useMemo(() => selectedPeriod.range(), [selectedPeriod]);

  const allowedAccountIds = useMemo(() => (selectedAccountId ? null : new Set(visibleAccountIds)), [
    selectedAccountId,
    visibleAccountIds,
  ]);

  const reportableTransactions = useMemo(() => {
    const scoped = filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
      if (!allowedAccountIds || allowedAccountIds.size === 0) {
        return true;
      }

      const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
      const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

      return fromAllowed || toAllowed;
    });

    return scoped.filter((transaction) => {
      const date = dayjs(transaction.date);
      return (
        !transaction.excludeFromReports &&
        !date.isBefore(start) &&
        !date.isAfter(end)
      );
    });
  }, [allowedAccountIds, end, selectedAccountId, start, transactions]);

  const weeks = useMemo(() => buildWeeksForMonth(start, end), [start, end]);

  const weeklySummaries: WeeklySummary[] = useMemo(
    () =>
      weeks.map((range) => {
        const rangeTransactions = reportableTransactions.filter((transaction) => {
          const date = dayjs(transaction.date);
          return !date.isBefore(range.start) && !date.isAfter(range.end);
        });

        const income = rangeTransactions
          .filter((transaction) => transaction.type === "income")
          .reduce((acc, transaction) => acc + transaction.amount, 0);
        const expense = rangeTransactions
          .filter((transaction) => transaction.type === "expense")
          .reduce((acc, transaction) => acc + transaction.amount, 0);

        const label = `${range.start.date()}–${range.end.date()}`;

        return {
          start: range.start,
          end: range.end,
          label,
          income,
          expense,
          net: income - expense,
        };
      }),
    [reportableTransactions, weeks],
  );

  const totalNet = weeklySummaries.reduce((acc, week) => acc + week.net, 0);

  const { positiveTicks, maxScaleValue } = useMemo(() => {
    const maxMagnitude = Math.max(
      0,
      ...weeklySummaries.map((week) => Math.max(week.income, week.expense)),
    );

    if (maxMagnitude === 0) {
      return { positiveTicks: [1, 2, 3], maxScaleValue: 3 };
    }

    const rawStep = maxMagnitude / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceStep = Math.ceil(rawStep / magnitude) * magnitude;

    return {
      positiveTicks: [niceStep, niceStep * 2, niceStep * 3],
      maxScaleValue: niceStep * 3,
    };
  }, [weeklySummaries]);

  const chartHeight = 176;
  const halfHeight = chartHeight / 2;
  const tickFractionDigits = maxScaleValue < 1 ? 2 : maxScaleValue < 10 ? 1 : 0;

  const handleOpenWeek = (week: WeeklySummary) => {
    router.push({
      pathname: "/transactions/net-income-week",
      params: {
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        accountId: selectedAccountId ?? "",
        period: selectedPeriodKey,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Net income details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.periodScroller}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={(width) => {
              if (width > 0) {
                periodScrollerRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ref={periodScrollerRef}
          >
            {periodOptions.map((option) => {
              const active = option.key === selectedPeriodKey;
              const { start: optionStart, end: optionEnd } = option.range();
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSelectedPeriodKey(option.key)}
                  style={[styles.periodChip, active && styles.periodChipActive(theme)]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${option.label}`}
                >
                  <Text style={[styles.periodChipLabel, active && styles.periodChipLabelActive(theme)]}>
                    {option.label}
                  </Text>
                  <Text style={styles.periodChipHint}>
                    {`${optionStart.format("MMM D")} – ${optionEnd.format("MMM D")}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.chartCard(theme)}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overline}>Total</Text>
              <Text style={styles.totalValue(totalNet >= 0)}>
                {formatCurrency(totalNet, currency, { signDisplay: "always" })}
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
              <Text style={styles.legendLabel}>Income</Text>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} />
              <Text style={styles.legendLabel}>Expense</Text>
            </View>
          </View>

          <View style={styles.chartArea}>
            <View style={[styles.axisColumn, { height: chartHeight }]}>
              <View style={styles.axisLine(theme)} />
              {[...positiveTicks].reverse().map((tick) => (
                <View
                  key={`axis-pos-${tick}`}
                  style={[
                    styles.axisTick,
                    styles.axisTickAnchor,
                    { top: halfHeight - (tick / maxScaleValue) * halfHeight },
                  ]}
                >
                  <Text style={styles.axisTickLabel}>
                    {formatCurrency(tick, currency, {
                      maximumFractionDigits: tickFractionDigits,
                      minimumFractionDigits: tickFractionDigits,
                    })}
                  </Text>
                  <View style={styles.axisTickMark(theme)} />
                </View>
              ))}
              {[...positiveTicks].map((tick) => (
                <View
                  key={`axis-neg-${tick}`}
                  style={[
                    styles.axisTick,
                    styles.axisTickAnchor,
                    { top: halfHeight + (tick / maxScaleValue) * halfHeight },
                  ]}
                >
                  <Text style={styles.axisTickLabel}>
                    {formatCurrency(-tick, currency, {
                      maximumFractionDigits: tickFractionDigits,
                      minimumFractionDigits: tickFractionDigits,
                    })}
                  </Text>
                  <View style={styles.axisTickMark(theme)} />
                </View>
              ))}
              <View style={[styles.axisTick, styles.axisTickAnchor, { top: halfHeight }]}>
                <Text style={styles.axisTickLabel}>0</Text>
                <View style={styles.axisTickMark(theme)} />
              </View>
            </View>

            <View style={[styles.barArea, { height: chartHeight }]}>
              <View style={styles.gridLayer(theme)} pointerEvents="none">
                {[...positiveTicks].map((tick) => (
                  <View
                    key={`grid-pos-${tick}`}
                    style={[
                      styles.gridLine,
                      { top: halfHeight - (tick / maxScaleValue) * halfHeight },
                    ]}
                  />
                ))}
                {[...positiveTicks].map((tick) => (
                  <View
                    key={`grid-neg-${tick}`}
                    style={[
                      styles.gridLine,
                      { top: halfHeight + (tick / maxScaleValue) * halfHeight },
                    ]}
                  />
                ))}
                <View
                  style={[
                    styles.gridLine,
                    styles.zeroGrid(theme),
                    { top: halfHeight, transform: [{ translateY: -0.5 }] },
                  ]}
                />
              </View>

              <View style={styles.barRow}>
                {weeklySummaries.map((week) => {
                  const incomeHeight =
                    week.income === 0 ? 0 : Math.max(6, (week.income / maxScaleValue) * halfHeight);
                  const expenseHeight =
                    week.expense === 0 ? 0 : Math.max(6, (week.expense / maxScaleValue) * halfHeight);
                  return (
                    <View key={week.label} style={styles.barColumn}>
                      <View style={[styles.barStack, { height: chartHeight }]}>
                        <View style={styles.barAbove}>
                          <View
                            style={[
                              styles.bar(theme),
                              styles.barIncome(theme),
                              incomeHeight === 0 && styles.barHidden,
                              { height: incomeHeight },
                            ]}
                          />
                        </View>
                        <View style={styles.barBelow}>
                          <View
                            style={[
                              styles.bar(theme),
                              styles.barExpense(theme),
                              expenseHeight === 0 && styles.barHidden,
                              { height: expenseHeight },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.barLabel}>{week.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Weekly breakdown</Text>
          <Text style={styles.listSubtitle}>Tap a week to view its transactions</Text>
        </View>

        {weeklySummaries.map((week) => (
          <Pressable
            key={week.label}
            onPress={() => handleOpenWeek(week)}
            style={styles.weekRow(theme)}
            accessibilityRole="button"
            accessibilityLabel={`Open week ${week.label}`}
          >
            <View style={styles.weekTopRow}>
              <View style={styles.weekInfo}>
                <Text style={styles.weekLabel}>{week.label}</Text>
              </View>
              <View style={styles.netPill(week.net >= 0, theme)}>
                <Text style={styles.netPillText(week.net >= 0, theme)}>
                  {formatCurrency(week.net, currency, { signDisplay: "always" })}
                </Text>
              </View>
            </View>

            <View style={styles.weekAmountsRow}>
              <View style={styles.weekStat(theme.colors.success, `${theme.colors.success}15`)}>
                <Text style={styles.weekStatLabel}>Income</Text>
                <Text style={styles.weekIncome}>{formatCurrency(week.income, currency)}</Text>
              </View>
              <View style={styles.weekStat(theme.colors.danger, `${theme.colors.danger}10`)}>
                <Text style={styles.weekStatLabel}>Expense</Text>
                <Text style={styles.weekExpense}>{formatCurrency(week.expense, currency)}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {weeklySummaries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trending-up" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No activity</Text>
            <Text style={styles.emptyText}>
              Add an income or expense in this month to see net income insights.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceElevated,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl * 2,
      gap: theme.spacing.lg,
    },
    periodScroller: {
      marginTop: theme.spacing.xs,
    },
    periodChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.lg,
      marginRight: theme.spacing.sm,
      gap: 2,
      minWidth: 120,
    },
    periodChipActive: (theme: ReturnType<typeof useAppTheme>) => ({
      borderWidth: 1,
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    }),
    periodChipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodChipLabelActive: (theme: ReturnType<typeof useAppTheme>) => ({
      color: theme.colors.primary,
    }),
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    metaRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
      alignItems: "center",
    },
    badge: (theme: ReturnType<typeof useAppTheme>) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
    }),
    badgeText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    chartCard: (theme: ReturnType<typeof useAppTheme>) => ({
      ...theme.components.card,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    }),
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    totalValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 6,
    },
    legendLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginRight: theme.spacing.sm,
    },
    chartArea: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      position: "relative",
      overflow: "hidden",
    },
    axisColumn: {
      width: 72,
      position: "relative",
      height: "100%",
      paddingRight: theme.spacing.sm,
    },
    axisTickAnchor: {
      transform: [{ translateY: -8 }],
    },
    axisTick: {
      position: "absolute",
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    axisTickLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "right",
    },
    axisTickMark: (theme: ReturnType<typeof useAppTheme>) => ({
      width: 12,
      height: 1,
      marginLeft: theme.spacing.xs,
      backgroundColor: `${theme.colors.textMuted}70`,
    }),
    axisLine: (theme: ReturnType<typeof useAppTheme>) => ({
      position: "absolute",
      top: 0,
      bottom: 0,
      right: theme.spacing.xs,
      width: 1,
      backgroundColor: `${theme.colors.border}aa`,
    }),
    barArea: {
      flex: 1,
      height: "100%",
      position: "relative",
    },
    gridLayer: (theme: ReturnType<typeof useAppTheme>) => ({
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    }),
    gridLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: `${theme.colors.textMuted}60`,
      opacity: 0.55,
      transform: [{ translateY: -0.5 }],
    },
    zeroGrid: (theme: ReturnType<typeof useAppTheme>) => ({
      backgroundColor: theme.colors.border,
      opacity: 0.65,
    }),
    barRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.sm,
      height: "100%",
    },
    barColumn: {
      flex: 1,
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    barStack: {
      flexDirection: "column",
      justifyContent: "center",
      width: "100%",
    },
    barAbove: {
      flex: 1,
      justifyContent: "flex-end",
    },
    barBelow: {
      flex: 1,
      justifyContent: "flex-start",
    },
    bar: (theme: ReturnType<typeof useAppTheme>) => ({
      borderRadius: theme.radii.md,
      width: "100%",
    }),
    barHidden: {
      opacity: 0.2,
    },
    barIncome: (theme: ReturnType<typeof useAppTheme>) => ({
      backgroundColor: `${theme.colors.success}dd`,
    }),
    barExpense: (theme: ReturnType<typeof useAppTheme>) => ({
      backgroundColor: `${theme.colors.danger}cc`,
    }),
    barLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    listHeader: {
      gap: 4,
      marginTop: theme.spacing.sm,
    },
    listTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    listSubtitle: {
      color: theme.colors.textMuted,
    },
    weekRow: (theme: ReturnType<typeof useAppTheme>) => ({
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg * 1.25,
      marginTop: theme.spacing.xs,
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 8,
    }),
    weekTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    weekInfo: {
      gap: 2,
    },
    weekLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekDate: {
      color: theme.colors.textMuted,
    },
    weekAmountsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    weekStat: (color: string, background: string) => ({
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      backgroundColor: background,
      borderWidth: 1,
      borderColor: `${color}40`,
      gap: 4,
    }),
    weekStatLabel: {
      color: theme.colors.textMuted,
      fontWeight: "600",
      fontSize: 12,
    },
    weekIncome: {
      color: theme.colors.success,
      fontWeight: "700",
    },
    weekExpense: {
      color: theme.colors.danger,
      fontWeight: "700",
    },
    netPill: (positive: boolean, theme: ReturnType<typeof useAppTheme>) => ({
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: positive ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
    }),
    netPillText: (positive: boolean, theme: ReturnType<typeof useAppTheme>) => ({
      color: positive ? theme.colors.success : theme.colors.danger,
      fontWeight: "700",
    }),
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyText: {
      color: theme.colors.textMuted,
      textAlign: "center",
      paddingHorizontal: theme.spacing.xl,
    },
  });
