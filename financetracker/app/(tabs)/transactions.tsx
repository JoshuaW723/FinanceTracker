import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs, { type Dayjs } from "dayjs";

import { colors, components, spacing, typography } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";

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

type PeriodKey = "this_week" | "this_month" | "last_month";

const periodOptions: {
  key: PeriodKey;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}[] = [
  {
    key: "this_week",
    label: "This Week",
    range: () => ({ start: dayjs().startOf("week"), end: dayjs().endOf("week") }),
  },
  {
    key: "this_month",
    label: "This Month",
    range: () => ({ start: dayjs().startOf("month"), end: dayjs().endOf("month") }),
  },
  {
    key: "last_month",
    label: "Last Month",
    range: () => {
      const previous = dayjs().subtract(1, "month");
      return { start: previous.startOf("month"), end: previous.endOf("month") };
    },
  },
];

export default function TransactionsScreen() {
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("this_month");
  const [reportExpanded, setReportExpanded] = useState(false);

  const { sections, summary, expenseBreakdown, periodLabel } = useMemo(() => {
    const period = periodOptions.find((option) => option.key === selectedPeriod) ?? periodOptions[0];
    const { start, end } = period.range();

    const withinRange = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });

    const sortedDesc = [...withinRange].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const grouped = new Map<string, Transaction[]>();
    sortedDesc.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      const existing = grouped.get(key) ?? [];
      existing.push(transaction);
      grouped.set(key, existing);
    });

    const sectionData = Array.from(grouped.entries()).map(([key, value]) => ({
      title: dayjs(key).format("dddd, MMM D"),
      data: value,
    }));

    const totals = withinRange.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else {
          acc.expense += transaction.amount;
        }

        return acc;
      },
      { income: 0, expense: 0 },
    );

    const sortedAsc = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let openingBalance = 0;
    let netChange = 0;

    sortedAsc.forEach((transaction) => {
      const value = transaction.type === "income" ? transaction.amount : -transaction.amount;
      const date = dayjs(transaction.date);

      if (date.isBefore(start)) {
        openingBalance += value;
      } else if (!date.isAfter(end)) {
        netChange += value;
      }
    });

    const closingBalance = openingBalance + netChange;

    const expenseMap = withinRange.reduce((acc, transaction) => {
      if (transaction.type !== "expense") {
        return acc;
      }

      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const expenseBreakdown = Array.from(expenseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totals.expense ? Math.round((amount / totals.expense) * 100) : 0,
      }));

    const breakdownLabel =
      period.key === "this_week"
        ? "this week"
        : period.key === "this_month"
          ? "this month"
          : "last month";

    return {
      sections: sectionData,
      summary: {
        income: totals.income,
        expense: totals.expense,
        net: totals.income - totals.expense,
        openingBalance,
        closingBalance,
      },
      expenseBreakdown,
      periodLabel: breakdownLabel,
    };
  }, [selectedPeriod, transactions]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingBlock}>
              <Text style={styles.title}>Transactions</Text>
              <Text style={styles.subtitle}>
                Review, filter, and report on your cash flow.
              </Text>
            </View>
            <View style={styles.periodTabs}>
              {periodOptions.map((option) => {
                const active = option.key === selectedPeriod;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.periodTab, active && styles.periodTabActive]}
                    onPress={() => setSelectedPeriod(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.periodText, active && styles.periodTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[components.card, styles.summaryCard]}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryTitleBlock}>
                  <Text style={styles.summaryLabel}>Ending balance</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(summary.closingBalance, currency || "USD")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.netBadge,
                    {
                      backgroundColor: summary.net >= 0 ? "rgba(52,211,153,0.12)" : "rgba(251,113,133,0.12)",
                    },
                  ]}
                >
                  <Ionicons
                    name={summary.net >= 0 ? "trending-up" : "trending-down"}
                    size={16}
                    color={summary.net >= 0 ? colors.success : colors.danger}
                  />
                  <Text
                    style={[
                      styles.netBadgeText,
                      { color: summary.net >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {formatCurrency(summary.net, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Opening balance</Text>
                  <Text style={[styles.statValue, styles.openingBalanceValue]}>
                    {formatCurrency(summary.openingBalance, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Income</Text>
                  <Text style={[styles.statValue, styles.incomeText]}>
                    {formatCurrency(summary.income, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.statLabel}>Spending</Text>
                  <Text style={[styles.statValue, styles.expenseText]}>
                    {formatCurrency(-summary.expense, currency || "USD", { signDisplay: "always" })}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.reportToggle}
                onPress={() => setReportExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: reportExpanded }}
              >
                <Text style={styles.reportToggleText}>
                  {reportExpanded ? "Hide" : "View"} report for this period
                </Text>
                <Ionicons
                  name={reportExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text}
                />
              </Pressable>
              {reportExpanded && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Category breakdown</Text>
                  {expenseBreakdown.length ? (
                    expenseBreakdown.map((category) => (
                      <View key={category.category} style={styles.reportRow}>
                        <View style={styles.reportLabelBlock}>
                          <Text style={styles.reportCategory}>{category.category}</Text>
                          <Text style={styles.reportAmount}>
                            {formatCurrency(category.amount, currency || "USD")}
                          </Text>
                        </View>
                        <View style={styles.reportProgressTrack}>
                          <View
                            style={[
                              styles.reportProgressFill,
                              {
                                width: `${Math.min(100, Math.max(6, category.percentage))}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.reportPercentage}>{category.percentage}%</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reportEmpty}>
                      No expenses logged for {periodLabel} yet.
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[components.surface, styles.transactionCard]}>
            <View style={styles.transactionMain}>
              <View
                style={[
                  styles.categoryAvatar,
                  item.type === "income" ? styles.avatarIncome : styles.avatarExpense,
                ]}
              >
                <Text style={styles.avatarText}>{item.category.charAt(0)}</Text>
              </View>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionNote}>{item.note}</Text>
                <Text style={styles.transactionMeta}>
                  {item.category} • {dayjs(item.date).format("h:mm A")}
                </Text>
              </View>
            </View>
            <View style={styles.transactionAmountBlock}>
              <Text
                style={[
                  styles.transactionAmount,
                  item.type === "income" ? styles.incomeText : styles.expenseText,
                ]}
              >
                {item.type === "income" ? "+" : "-"}
                {formatCurrency(item.amount, currency || "USD")}
              </Text>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="documents-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Transactions that match your selected period will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.lg,
  },
  headingBlock: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
  },
  periodTabs: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.xs,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  periodTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
  },
  periodText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  periodTextActive: {
    color: colors.text,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    gap: spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitleBlock: {
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.subtitle,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },
  netBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  netBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  summaryStat: {
    flex: 1,
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  openingBalanceValue: {
    color: colors.accent,
  },
  reportToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  reportToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  reportCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.lg,
    padding: spacing.lg,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.2,
  },
  reportRow: {
    gap: spacing.sm,
  },
  reportLabelBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  reportAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  reportProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  reportProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  reportPercentage: {
    fontSize: 12,
    color: colors.textMuted,
  },
  reportEmpty: {
    ...typography.subtitle,
  },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  transactionMain: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    flex: 1,
  },
  categoryAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  transactionCopy: {
    gap: spacing.xs,
    flexShrink: 1,
  },
  transactionNote: {
    ...typography.body,
    fontWeight: "600",
  },
  transactionMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  transactionAmountBlock: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  incomeText: {
    color: colors.success,
  },
  expenseText: {
    color: colors.danger,
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    ...typography.subtitle,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});
