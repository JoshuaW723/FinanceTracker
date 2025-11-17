import { useMemo, useState } from "react";
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
  dateLabel: string;
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
  let cursor = start.startOf("week").add(1, "day");

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const weekStart = cursor;
    const weekEnd = cursor.add(6, "day");
    weeks.push({
      start: weekStart.isBefore(start) ? start : weekStart,
      end: weekEnd.isAfter(end) ? end : weekEnd,
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

  const periodOptions = useMemo(() => buildMonthlyPeriods().slice().reverse(), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return periodOptions.find((option) => option.key === key) ?? periodOptions[0];
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
        const dateLabel = `${range.start.format("MMM D")} • ${range.end.format("ddd")}`;

        return {
          start: range.start,
          end: range.end,
          label,
          dateLabel,
          income,
          expense,
          net: income - expense,
        };
      }),
    [reportableTransactions, weeks],
  );

  const totalNet = weeklySummaries.reduce((acc, week) => acc + week.net, 0);
  const maxVolume = Math.max(
    1,
    ...weeklySummaries.map((week) => Math.max(week.income, week.expense)),
  );

  const accountLabel = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId)?.name ?? "Account"
    : "All accounts";

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        <View style={styles.metaRow}>
          <View style={styles.badge(theme)}>
            <Ionicons name="calendar" size={14} color={theme.colors.text} />
            <Text style={styles.badgeText}>{start.format("MMMM YYYY")}</Text>
          </View>
          <View style={styles.badge(theme)}>
            <Ionicons name="wallet" size={14} color={theme.colors.text} />
            <Text style={styles.badgeText}>{accountLabel}</Text>
          </View>
        </View>

        <View style={styles.card(theme)}>
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
            {weeklySummaries.map((week) => {
              const incomeHeight = Math.max(6, (week.income / maxVolume) * 120);
              const expenseHeight = Math.max(6, (week.expense / maxVolume) * 120);
              return (
                <View key={week.label} style={styles.barColumn}>
                  <View style={styles.barStack}>
                    <View style={[styles.bar(theme), styles.barIncome(theme), { height: incomeHeight }]} />
                    <View style={[styles.bar(theme), styles.barExpense(theme), { height: expenseHeight }]} />
                  </View>
                  <Text style={styles.barLabel}>{week.label}</Text>
                </View>
              );
            })}
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
            <View style={styles.weekInfo}>
              <Text style={styles.weekLabel}>{week.label}</Text>
              <Text style={styles.weekDate}>{week.dateLabel}</Text>
            </View>
            <View style={styles.weekAmounts}>
              <Text style={styles.weekIncome}>
                {formatCurrency(week.income, currency)}
              </Text>
              <Text style={styles.weekExpense}>
                {formatCurrency(week.expense, currency)}
              </Text>
              <View style={styles.netPill(week.net >= 0, theme)}>
                <Text style={styles.netPillText(week.net >= 0, theme)}>
                  {formatCurrency(week.net, currency, { signDisplay: "always" })}
                </Text>
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
    card: (theme: ReturnType<typeof useAppTheme>) => ({
      ...theme.components.card,
      padding: theme.spacing.lg,
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
      alignItems: "flex-end",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: theme.spacing.lg,
    },
    barColumn: {
      flex: 1,
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    barStack: {
      flexDirection: "column",
      justifyContent: "flex-end",
      width: "100%",
      gap: 6,
    },
    bar: (theme: ReturnType<typeof useAppTheme>) => ({
      borderRadius: theme.radii.sm,
      width: "100%",
      minHeight: 10,
    }),
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      marginTop: theme.spacing.sm,
      borderWidth: 1,
      borderColor: `${theme.colors.border}80`,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 8,
    }),
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
    weekAmounts: {
      alignItems: "flex-end",
      gap: 4,
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
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
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
