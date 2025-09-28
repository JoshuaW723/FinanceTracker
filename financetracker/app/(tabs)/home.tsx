import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { MiniBarChart } from "../../components/MiniBarChart";
import { colors, components, spacing, typography } from "../../theme";
import { useFinanceStore } from "../../lib/store";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(value);

export default function HomeScreen() {
  const transactions = useFinanceStore((state) => state.transactions);
  const profile = useFinanceStore((state) => state.profile);
  const [spendingPeriod, setSpendingPeriod] = useState<"week" | "month">("week");

  const balance = useMemo(
    () =>
      transactions.reduce((acc, transaction) => {
        const multiplier = transaction.type === "income" ? 1 : -1;
        return acc + transaction.amount * multiplier;
      }, 0),
    [transactions],
  );

  const { incomeThisMonth, expenseThisMonth } = useMemo(() => {
    const startOfMonth = dayjs().startOf("month");
    return transactions.reduce(
      (acc, transaction) => {
        if (dayjs(transaction.date).isBefore(startOfMonth)) {
          return acc;
        }

        if (transaction.type === "income") {
          acc.incomeThisMonth += transaction.amount;
        } else {
          acc.expenseThisMonth += transaction.amount;
        }

        return acc;
      },
      { incomeThisMonth: 0, expenseThisMonth: 0 },
    );
  }, [transactions]);

  const chartData = useMemo(() => {
    const today = dayjs();

    return Array.from({ length: 7 }).map((_, index) => {
      const day = today.subtract(6 - index, "day");
      const totalForDay = transactions
        .filter((transaction) => dayjs(transaction.date).isSame(day, "day"))
        .reduce((acc, transaction) => {
          const multiplier = transaction.type === "income" ? 1 : -1;
          return acc + transaction.amount * multiplier;
        }, 0);

      return {
        label: day.format("dd"),
        value: totalForDay,
      };
    });
  }, [transactions]);

  const currency = profile.currency || "USD";
  const formattedBalance = formatCurrency(balance, currency);
  const formattedIncome = formatCurrency(incomeThisMonth, currency);
  const formattedExpenses = formatCurrency(expenseThisMonth, currency);

  const netPositive = incomeThisMonth - expenseThisMonth;
  const netPercentage = incomeThisMonth
    ? Math.min(100, Math.round((expenseThisMonth / incomeThisMonth) * 100))
    : 0;

  const topSpending = useMemo(() => {
    const today = dayjs();
    const rangeStart =
      spendingPeriod === "week" ? today.startOf("week") : today.startOf("month");
    const rangeEnd =
      spendingPeriod === "week" ? today.endOf("week") : today.endOf("month");

    const expenses = transactions.filter((transaction) => {
      if (transaction.type !== "expense") {
        return false;
      }

      const date = dayjs(transaction.date);
      return !date.isBefore(rangeStart) && !date.isAfter(rangeEnd);
    });

    const totalsByCategory = expenses.reduce((acc, transaction) => {
      const previous = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, previous + transaction.amount);
      return acc;
    }, new Map<string, number>());

    let topCategory: { name: string; amount: number } | null = null;
    totalsByCategory.forEach((amount, name) => {
      if (!topCategory || amount > topCategory.amount) {
        topCategory = { name, amount };
      }
    });

    const totalSpent = expenses.reduce((acc, transaction) => acc + transaction.amount, 0);

    return {
      category: topCategory?.name ?? null,
      amount: topCategory?.amount ?? 0,
      percentage: totalSpent ? Math.round(((topCategory?.amount ?? 0) / totalSpent) * 100) : 0,
      totalSpent,
    };
  }, [spendingPeriod, transactions]);

  const netIsPositive = netPositive >= 0;
  const netBadgeColor = netIsPositive ? colors.success : colors.danger;
  const netBadgeBackground = netIsPositive
    ? "rgba(52,211,153,0.12)"
    : "rgba(251,113,133,0.12)";
  const netIcon = netIsPositive ? "trending-up" : "trending-down";
  const netLabel = `${formatCurrency(netPositive, currency, { signDisplay: "always" })} net`;

  const spendingLabel = spendingPeriod === "week" ? "week" : "month";

  const snapshot = useMemo(() => {
    const today = dayjs();
    const startOfMonth = today.startOf("month");
    const daysElapsed = Math.max(1, today.diff(startOfMonth, "day") + 1);

    const thisMonthTransactions = transactions.filter((transaction) =>
      dayjs(transaction.date).isSame(today, "month"),
    );

    const expenseTotal = thisMonthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((acc, transaction) => acc + transaction.amount, 0);

    const averageDailySpend = expenseTotal / daysElapsed;

    const savingsRate = incomeThisMonth
      ? Math.round(((incomeThisMonth - expenseThisMonth) / incomeThisMonth) * 100)
      : 0;

    const largestExpense = thisMonthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce<{
        amount: number;
        label: string | null;
      }>(
        (acc, transaction) => {
          if (transaction.amount > acc.amount) {
            return { amount: transaction.amount, label: transaction.category };
          }
          return acc;
        },
        { amount: 0, label: null },
      );

    const runwayDays = averageDailySpend > 0 ? Math.floor(Math.max(0, balance) / averageDailySpend) : null;

    return {
      averageDailySpend,
      savingsRate,
      largestExpense,
      runwayDays,
      transactionCount: thisMonthTransactions.length,
      reportingThrough: today.format("MMM D"),
    };
  }, [balance, expenseThisMonth, incomeThisMonth, transactions]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hello}>Hey {profile.name.split(" ")[0]} 👋</Text>
          <Text style={styles.subtitle}>Your money dashboard is glowing.</Text>
        </View>

        <View style={[components.card, styles.balanceCard]}>
          <Text style={styles.balanceLabel}>Current balance</Text>
          <Text style={styles.balanceValue}>{formattedBalance}</Text>
          <View style={styles.balanceMetaRow}>
            <View style={[styles.metaBadge, { backgroundColor: netBadgeBackground }]}>
              <Ionicons name={netIcon} size={16} color={netBadgeColor} />
              <Text style={[styles.metaText, { color: netBadgeColor }]}>{netLabel}</Text>
            </View>
            <Text style={styles.metaCaption}>{dayjs().format("MMMM YYYY")}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${netPercentage}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <View>
              <Text style={styles.label}>Income</Text>
              <Text style={styles.labelValuePositive}>{formattedIncome}</Text>
            </View>
            <View>
              <Text style={styles.label}>Spending</Text>
              <Text style={styles.labelValueNegative}>{formattedExpenses}</Text>
            </View>
          </View>
        </View>

        <View style={[components.surface, styles.topSpendingCard]}>
          <View style={styles.topSpendingHeader}>
            <Text style={styles.topSpendingTitle}>Top spending</Text>
            <View style={styles.periodSwitch}>
              {["week", "month"].map((period) => {
                const active = spendingPeriod === period;
                return (
                  <Pressable
                    key={period}
                    onPress={() => setSpendingPeriod(period as typeof spendingPeriod)}
                    style={[styles.periodPill, active && styles.periodPillActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.periodLabel, active && styles.periodLabelActive]}>
                      {period === "week" ? "This week" : "This month"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {topSpending.category ? (
            <View style={styles.topSpendingBody}>
              <View style={styles.topSpendingRow}>
                <View>
                  <Text style={styles.topSpendingCaption}>Highest category</Text>
                  <Text style={styles.topSpendingCategory}>{topSpending.category}</Text>
                </View>
                <Text style={styles.topSpendingAmount}>
                  {formatCurrency(topSpending.amount, currency)}
                </Text>
              </View>
              <View style={styles.spendingProgressTrack}>
                <View style={[styles.spendingProgressFill, { width: `${topSpending.percentage}%` }]} />
              </View>
              <Text style={styles.spendingSummary}>
                {topSpending.percentage}% of your spending this {spendingLabel}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>
                No expenses tracked for this {spendingLabel} yet.
              </Text>
            </View>
          )}
        </View>

        <View style={[components.surface, styles.snapshotCard]}>
          <View style={styles.snapshotHeader}>
            <Text style={styles.snapshotTitle}>Monthly snapshot</Text>
            <Text style={styles.snapshotSubtitle}>Up to {snapshot.reportingThrough}</Text>
          </View>
          <View style={styles.snapshotGrid}>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotLabel}>Avg daily spend</Text>
              <Text style={[styles.snapshotValue, styles.snapshotValueNegative]}>
                {formatCurrency(snapshot.averageDailySpend || 0, currency, { maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotLabel}>Savings rate</Text>
              <Text
                style={[
                  styles.snapshotValue,
                  snapshot.savingsRate >= 0 ? styles.snapshotValuePositive : styles.snapshotValueNegative,
                ]}
              >
                {snapshot.savingsRate}%
              </Text>
            </View>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotLabel}>Transactions logged</Text>
              <Text style={styles.snapshotValue}>{snapshot.transactionCount}</Text>
            </View>
            <View style={styles.snapshotStat}>
              <Text style={styles.snapshotLabel}>Cash runway</Text>
              <Text style={styles.snapshotValue}>
                {snapshot.runwayDays !== null ? `${snapshot.runwayDays} days` : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.snapshotFooter}>
            <Text style={styles.snapshotLabel}>Largest expense this month</Text>
            {snapshot.largestExpense.label ? (
              <Text style={[styles.snapshotValue, styles.snapshotValueNegative]}>
                {snapshot.largestExpense.label} · {formatCurrency(snapshot.largestExpense.amount, currency)}
              </Text>
            ) : (
              <Text style={styles.snapshotValue}>No expenses logged yet</Text>
            )}
          </View>
        </View>

        <View style={[components.surface, styles.chartCard]}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>7-day cash flow</Text>
            <Text style={styles.chartCaption}>Income vs. spend</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartContent}
          >
            <MiniBarChart data={chartData} style={styles.chart} />
          </ScrollView>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  hello: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
  },
  balanceCard: {
    gap: spacing.lg,
  },
  balanceLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  balanceValue: {
    fontSize: 44,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.4,
  },
  balanceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaCaption: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    ...typography.subtitle,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  labelValuePositive: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.success,
    marginTop: 4,
  },
  labelValueNegative: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.danger,
    marginTop: 4,
  },
  chartCard: {
    gap: spacing.lg,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: {
    ...typography.body,
    fontSize: 18,
    fontWeight: "600",
  },
  chartCaption: {
    ...typography.subtitle,
  },
  chart: {
    paddingVertical: spacing.md,
  },
  chartContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingRight: spacing.lg,
  },
  topSpendingCard: {
    gap: spacing.lg,
  },
  topSpendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topSpendingTitle: {
    ...typography.body,
    fontSize: 18,
    fontWeight: "600",
  },
  periodSwitch: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: spacing.xs / 2,
    gap: spacing.xs,
  },
  periodPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  periodPillActive: {
    backgroundColor: colors.primary,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  periodLabelActive: {
    color: colors.text,
  },
  snapshotCard: {
    gap: spacing.lg,
  },
  snapshotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  snapshotTitle: {
    ...typography.body,
    fontSize: 18,
    fontWeight: "600",
  },
  snapshotSubtitle: {
    ...typography.subtitle,
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  snapshotStat: {
    width: "47%",
    gap: spacing.xs,
  },
  snapshotLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  snapshotValuePositive: {
    color: colors.success,
  },
  snapshotValueNegative: {
    color: colors.danger,
  },
  snapshotFooter: {
    gap: spacing.xs,
  },
  topSpendingBody: {
    gap: spacing.md,
  },
  topSpendingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topSpendingCaption: {
    ...typography.subtitle,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  topSpendingCategory: {
    ...typography.body,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  topSpendingAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.danger,
  },
  spendingProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  spendingProgressFill: {
    height: "100%",
    backgroundColor: colors.danger,
  },
  spendingSummary: {
    ...typography.subtitle,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyStateText: {
    ...typography.subtitle,
    textAlign: "center",
  },
});
