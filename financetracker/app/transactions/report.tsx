import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import dayjs from "dayjs";

import { useAppTheme, type Theme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount, getTransactionDelta } from "../../lib/transactions";

const chartPalette = [
  "#60A5FA",
  "#34D399",
  "#F97316",
  "#F472B6",
  "#A78BFA",
  "#FB7185",
  "#FBBF24",
];

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

interface CategorySlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

const polarToCartesian = (center: number, radius: number, angle: number) => ({
  x: center + radius * Math.cos(angle),
  y: center + radius * Math.sin(angle),
});

const describeArc = (
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(center, radius, startAngle);
  const end = polarToCartesian(center, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const PieChart = ({ data, size = 140, theme }: { data: CategorySlice[]; size?: number; theme: Theme }) => {
  const radius = size / 2;
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let startAngle = -Math.PI / 2;

  const segments = total
    ? data.map((item) => {
        const angle = total ? (item.value / total) * Math.PI * 2 : 0;
        const path = describeArc(radius, radius, startAngle, startAngle + angle);
        startAngle += angle;
        return { path, color: item.color };
      })
    : [];

  return (
    <Svg width={size} height={size}>
      {segments.length === 0 ? (
        <Circle cx={radius} cy={radius} r={radius} fill={`${theme.colors.border}55`} />
      ) : (
        segments.map((segment, index) => <Path key={index} d={segment.path} fill={segment.color} />)
      )}
      <Circle cx={radius} cy={radius} r={radius * 0.55} fill={theme.colors.surface} />
    </Svg>
  );
};

export default function TransactionsReportModal() {
  const theme = useAppTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { period: periodParam, accountId } = useLocalSearchParams<{ period?: string; accountId?: string }>();
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const resolvedPeriod = useMemo(() => {
    const key = typeof periodParam === "string" ? periodParam : undefined;
    return periodOptions.find((option) => option.key === key) ?? periodOptions[periodOptions.length - 1];
  }, [periodOptions, periodParam]);

  const { start, end } = useMemo(() => resolvedPeriod.range(), [resolvedPeriod]);
  const selectedAccountId = typeof accountId === "string" && accountId.length ? accountId : null;
  const accountName = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId)?.name ?? "Selected account"
    : "All accounts";
  const rangeLabel = `${start.format("MMM D")} – ${end.format("MMM D, YYYY")}`;

  const report = useMemo(() => {
    const scopedTransactions = filterTransactionsByAccount(transactions, selectedAccountId);
    const withinRange = scopedTransactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return !date.isBefore(start) && !date.isAfter(end);
    });

    const reportable = withinRange.filter((transaction) => !transaction.excludeFromReports);

    const totals = reportable.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount;
        } else if (transaction.type === "expense") {
          acc.expense += transaction.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const netChange = reportable.reduce(
      (acc, transaction) => acc + getTransactionDelta(transaction, selectedAccountId),
      0,
    );

    let openingBalance = 0;
    scopedTransactions
      .filter((transaction) => !transaction.excludeFromReports)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
      .forEach((transaction) => {
        if (dayjs(transaction.date).isBefore(start)) {
          openingBalance += getTransactionDelta(transaction, selectedAccountId);
        }
      });

    const closingBalance = openingBalance + netChange;

    const buildSlices = (type: "income" | "expense", total: number): CategorySlice[] => {
      if (!total) {
        return [];
      }
      const map = new Map<string, number>();
      reportable.forEach((transaction) => {
        if (transaction.type !== type) {
          return;
        }
        const key = transaction.category || (type === "income" ? "Income" : "Expense");
        map.set(key, (map.get(key) ?? 0) + transaction.amount);
      });

      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value], index) => ({
          label,
          value,
          percentage: Math.round((value / total) * 100),
          color: chartPalette[index % chartPalette.length],
        }));
    };

    return {
      openingBalance,
      closingBalance,
      netChange,
      totals,
      incomeSlices: buildSlices("income", totals.income),
      expenseSlices: buildSlices("expense", totals.expense),
    };
  }, [end, selectedAccountId, start, transactions]);

  const netPositive = report.netChange >= 0;
  const accountLabel = selectedAccountId ? accountName : "All accounts";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={20} color={theme.colors.text} />
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>{resolvedPeriod.label}</Text>
            <Text style={styles.metaSubValue}>{rangeLabel}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Account</Text>
            <Text style={styles.metaValue}>{accountLabel}</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceOverline}>Opening balance</Text>
            <Text style={styles.balanceOverline}>Ending balance</Text>
          </View>
          <View style={styles.balanceValues}>
            <Text style={styles.balanceValue}>{formatCurrency(report.openingBalance, currency)}</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textMuted} />
            <Text style={styles.balanceValue}>{formatCurrency(report.closingBalance, currency)}</Text>
          </View>
          <Text style={styles.balanceRange}>Net change reflects all reportable transactions for this period.</Text>
        </View>

        <View style={styles.netCard}>
          <View style={styles.netHeader}>
            <Text style={styles.netTitle}>Net income</Text>
            <Text style={styles.netLink}>See details</Text>
          </View>
          <Text style={styles.netAmount(netPositive)}>
            {formatCurrency(report.netChange, currency, { signDisplay: "always" })}
          </Text>
          <View style={styles.netBreakdownRow}>
            <View style={styles.netBreakdownItem}>
              <Text style={styles.netLabel}>Income</Text>
              <Text style={styles.netValue(theme.colors.success)}>
                {formatCurrency(report.totals.income, currency)}
              </Text>
            </View>
            <View style={styles.netBreakdownItem}>
              <Text style={styles.netLabel}>Expense</Text>
              <Text style={styles.netValue(theme.colors.danger)}>
                {formatCurrency(report.totals.expense, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>Category report</Text>
            <Text style={styles.categorySubtitle}>Breakdown of income and spend</Text>
          </View>
          <View style={styles.categoryGrid}>
            <View style={styles.categoryColumn}>
              <Text style={styles.categoryColumnLabel}>Income</Text>
              <PieChart data={report.incomeSlices} theme={theme} />
              <View style={styles.legend}>{renderLegend(report.incomeSlices, currency, theme)}</View>
            </View>
            <View style={styles.categoryColumn}>
              <Text style={styles.categoryColumnLabel}>Expense</Text>
              <PieChart data={report.expenseSlices} theme={theme} />
              <View style={styles.legend}>{renderLegend(report.expenseSlices, currency, theme)}</View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const renderLegend = (data: CategorySlice[], currency: string, theme: Theme) => {
  const styles = legendStyles(theme);

  if (!data.length) {
    return <Text style={styles.emptyLegend}>No data for this period</Text>;
  }

  return data.map((item) => (
    <View key={`${item.label}-${item.color}`} style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
      <View style={styles.legendMeta}>
        <Text style={styles.legendLabel}>{item.label}</Text>
        <Text style={styles.legendAmount}>
          {formatCurrency(item.value, currency)} · {item.percentage}%
        </Text>
      </View>
    </View>
  ));
};

const legendStyles = (theme: Theme) =>
  StyleSheet.create({
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendMeta: {
      flex: 1,
    },
    legendLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    legendAmount: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    emptyLegend: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    closeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    closeLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 60,
    },
    content: {
      padding: 20,
      gap: 16,
      paddingBottom: 40,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    metaLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    metaValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    metaSubValue: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    balanceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 12,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    balanceOverline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    balanceValues: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    balanceValue: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    balanceRange: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    netCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 12,
    },
    netHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    netTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    netLink: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: "600",
    },
    netAmount: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    netBreakdownRow: {
      flexDirection: "row",
      gap: 16,
    },
    netBreakdownItem: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceElevated,
    },
    netLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    netValue: (color: string) => ({
      fontSize: 18,
      fontWeight: "600",
      color,
    }),
    categoryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      gap: 20,
    },
    categoryHeader: {
      gap: 4,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categorySubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    categoryGrid: {
      flexDirection: "row",
      gap: 16,
    },
    categoryColumn: {
      flex: 1,
      alignItems: "center",
      gap: 12,
    },
    categoryColumnLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    legend: {
      alignSelf: "stretch",
    },
  });
