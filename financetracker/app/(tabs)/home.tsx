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
  const [spendingPeriod, setSpendingPeriod] = useState<"week" | "month">("month");

  const balance = useMemo(
    () =>
      transactions.reduce((acc, transaction) => {
        const multiplier = transaction.type === "income" ? 1 : -1;
        return acc + transaction.amount * multiplier;
      }, 0),
    [transactions],
  );

  const startOfMonth = useMemo(() => dayjs().startOf("month"), []);
  const endOfMonth = useMemo(() => dayjs().endOf("month"), []);

  const summary = useMemo(
    () =>
      transactions.reduce(
        (acc, transaction) => {
          const value = transaction.type === "income" ? transaction.amount : -transaction.amount;
          const date = dayjs(transaction.date);

          if (date.isBefore(startOfMonth)) {
            acc.openingBalance += value;
          }

          if (!date.isBefore(startOfMonth) && !date.isAfter(endOfMonth)) {
            if (transaction.type === "income") {
              acc.income += transaction.amount;
            } else {
              acc.expense += transaction.amount;
            }
            acc.monthNet += value;
          }

          return acc;
        },
        { income: 0, expense: 0, openingBalance: 0, monthNet: 0 },
      ),
    [endOfMonth, startOfMonth, transactions],
  );

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
  const formattedIncome = formatCurrency(summary.income, currency);
  const formattedExpenses = formatCurrency(summary.expense, currency);

  const netChangeThisMonth = summary.income - summary.expense;
  const netIsPositive = netChangeThisMonth >= 0;
  const netBadgeColor = netIsPositive ? colors.success : colors.danger;
  const netBadgeBackground = netIsPositive
    ? "rgba(52,211,153,0.16)"
    : "rgba(251,113,133,0.16)";
  const netIcon = netIsPositive ? "trending-up" : "trending-down";
  const netLabel = `${formatCurrency(netChangeThisMonth, currency, { signDisplay: "always" })} this month`;

  const topSpending = useMemo(() => {
    const today = dayjs();
    const rangeStart = spendingPeriod === "week" ? today.startOf("week") : today.startOf("month");
    const rangeEnd = spendingPeriod === "week" ? today.endOf("week") : today.endOf("month");

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

    const totalSpent = expenses.reduce((acc, transaction) => acc + transaction.amount, 0);

    const entries = Array.from(totalsByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
      }));

    return { entries, totalSpent };
  }, [spendingPeriod, transactions]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    [transactions],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hello}>Welcome back, {profile.name.split(" ")[0]}</Text>
          <Text style={styles.subtitle}>Here’s a tidy look at your money this month.</Text>
        </View>

        <View style={[components.card, styles.balanceCard]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Ionicons name="eye" size={18} color={colors.textMuted} />
          </View>
          <Text style={styles.balanceValue}>{formattedBalance}</Text>
          <View style={styles.balanceMetaRow}>
            <View style={[styles.metaBadge, { backgroundColor: netBadgeBackground }]}>
              <Ionicons name={netIcon} size={16} color={netBadgeColor} />
              <Text style={[styles.metaText, { color: netBadgeColor }]}>{netLabel}</Text>
            </View>
            <Text style={styles.metaCaption}>{dayjs().format("MMMM YYYY")}</Text>
          </View>
          <View style={styles.balanceBreakdown}>
            <View style={styles.balanceColumn}>
              <Text style={styles.breakdownLabel}>Opening balance</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(summary.openingBalance, currency)}
              </Text>
            </View>
            <View style={styles.balanceColumn}>
              <Text style={styles.breakdownLabel}>Ending balance</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(summary.openingBalance + summary.monthNet, currency)}
              </Text>
            </View>
          </View>
          <Pressable style={styles.reportsLink} accessibilityRole="button">
            <Text style={styles.reportsText}>View reports</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[components.surface, styles.monthlyReport]}>
          <View style={styles.monthlyHeader}>
            <View>
              <Text style={styles.monthlyTitle}>This month</Text>
              <Text style={styles.monthlyCaption}>Income vs spending</Text>
            </View>
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
                      {period === "week" ? "Week" : "Month"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.reportTotals}>
            <View>
              <Text style={styles.reportLabel}>Total spent</Text>
              <Text style={[styles.reportValue, styles.reportValueNegative]}>{formattedExpenses}</Text>
            </View>
            <View>
              <Text style={styles.reportLabel}>Total income</Text>
              <Text style={[styles.reportValue, styles.reportValuePositive]}>{formattedIncome}</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartContent}
          >
            <MiniBarChart data={chartData} style={styles.chart} />
          </ScrollView>
        </View>

        <View style={[components.surface, styles.topSpendingCard]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top spending</Text>
            <Text style={styles.sectionCaption}>
              {topSpending.totalSpent
                ? formatCurrency(topSpending.totalSpent, currency)
                : "No spend"}
            </Text>
          </View>
          {topSpending.entries.length ? (
            <View style={styles.topSpendingList}>
              {topSpending.entries.map((entry) => (
                <View key={entry.category} style={styles.topSpendingItem}>
                  <View style={styles.topSpendingItemHeader}>
                    <Text style={styles.topSpendingName}>{entry.category}</Text>
                    <Text style={styles.topSpendingAmount}>
                      {formatCurrency(entry.amount, currency)}
                    </Text>
                  </View>
                  <View style={styles.spendingProgressTrack}>
                    <View
                      style={[
                        styles.spendingProgressFill,
                        { width: `${Math.min(100, entry.percentage)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.spendingPercentage}>{entry.percentage}% of spend</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>Track a few expenses to see insights.</Text>
            </View>
          )}
        </View>

        <View style={[components.surface, styles.recentCard]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <Text style={styles.sectionCaption}>Last {recentTransactions.length || 0}</Text>
          </View>
          {recentTransactions.length ? (
            <View style={styles.recentList}>
              {recentTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.recentRow}>
                  <View
                    style={[
                      styles.recentAvatar,
                      transaction.type === "income" ? styles.avatarIncome : styles.avatarExpense,
                    ]}
                  >
                    <Text style={styles.avatarText}>{transaction.category.charAt(0)}</Text>
                  </View>
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentNote}>{transaction.note}</Text>
                    <Text style={styles.recentMeta}>
                      {dayjs(transaction.date).format("ddd, D MMM")} • {transaction.category}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recentAmount,
                      transaction.type === "income"
                        ? styles.reportValuePositive
                        : styles.reportValueNegative,
                    ]}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount, currency)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No transactions logged yet.</Text>
            </View>
          )}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  hello: {
    ...typography.title,
    fontSize: 24,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
  },
  balanceCard: {
    gap: spacing.md,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  balanceValue: {
    fontSize: 40,
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
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metaCaption: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  balanceBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  balanceColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  reportsLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  reportsText: {
    color: colors.primary,
    fontWeight: "600",
  },
  monthlyReport: {
    gap: spacing.md,
  },
  monthlyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthlyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  monthlyCaption: {
    ...typography.subtitle,
  },
  periodSwitch: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: spacing.xs,
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
  reportTotals: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reportLabel: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  reportValue: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  reportValuePositive: {
    color: colors.success,
  },
  reportValueNegative: {
    color: colors.danger,
  },
  chartContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingRight: spacing.md,
  },
  chart: {
    paddingVertical: spacing.sm,
  },
  topSpendingCard: {
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionCaption: {
    fontSize: 13,
    color: colors.textMuted,
  },
  topSpendingList: {
    gap: spacing.md,
  },
  topSpendingItem: {
    gap: spacing.xs,
  },
  topSpendingItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topSpendingName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  topSpendingAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  spendingProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  spendingProgressFill: {
    height: "100%",
    backgroundColor: colors.danger,
  },
  spendingPercentage: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recentCard: {
    gap: spacing.md,
  },
  recentList: {
    gap: spacing.md,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIncome: {
    backgroundColor: "rgba(52,211,153,0.16)",
  },
  avatarExpense: {
    backgroundColor: "rgba(251,113,133,0.16)",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  recentCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  recentNote: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  recentMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recentAmount: {
    fontSize: 16,
    fontWeight: "700",
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
