import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import Svg, { Circle, Path } from "react-native-svg";

import { useAppTheme, type Theme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount } from "../../lib/transactions";

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

const PieChart = ({ data, size = 160, theme }: { data: CategorySlice[]; size?: number; theme: Theme }) => {
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

interface Params {
  type?: string;
  period?: string;
  accountId?: string;
}

export default function CategoryDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { type: typeParam, period: periodParam, accountId } = useLocalSearchParams<Params>();
  const periodScrollerRef = useRef<ScrollView | null>(null);

  const categoryType = typeParam === "income" ? "income" : "expense";
  const title = categoryType === "income" ? "Income details" : "Expense details";

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

  const scopedTransactions = useMemo(
    () =>
      filterTransactionsByAccount(transactions, selectedAccountId).filter((transaction) => {
        if (!allowedAccountIds || allowedAccountIds.size === 0) {
          return true;
        }

        const fromAllowed = transaction.accountId ? allowedAccountIds.has(transaction.accountId) : false;
        const toAllowed = transaction.toAccountId ? allowedAccountIds.has(transaction.toAccountId) : false;

        return fromAllowed || toAllowed;
      }),
    [allowedAccountIds, selectedAccountId, transactions],
  );

  const reportableTransactions = useMemo(
    () => scopedTransactions.filter((transaction) => !transaction.excludeFromReports),
    [scopedTransactions],
  );

  const withinPeriodTransactions = useMemo(
    () =>
      reportableTransactions.filter((transaction) => {
        const date = dayjs(transaction.date);
        return !date.isBefore(start) && !date.isAfter(end);
      }),
    [end, reportableTransactions, start],
  );

  const categoryTransactions = useMemo(
    () => withinPeriodTransactions.filter((transaction) => transaction.type === categoryType),
    [categoryType, withinPeriodTransactions],
  );

  const totalAmount = useMemo(
    () => categoryTransactions.reduce((acc, transaction) => acc + transaction.amount, 0),
    [categoryTransactions],
  );

  const daysInPeriod = useMemo(() => Math.max(end.diff(start, "day") + 1, 1), [end, start]);
  const dailyAverage = totalAmount / daysInPeriod;

  const calculateRangeTotal = useMemo(
    () =>
      (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) =>
        reportableTransactions.reduce((acc, transaction) => {
          if (transaction.type !== categoryType) {
            return acc;
          }
          const date = dayjs(transaction.date);
          if (date.isBefore(rangeStart) || date.isAfter(rangeEnd)) {
            return acc;
          }
          return acc + transaction.amount;
        }, 0),
    [categoryType, reportableTransactions],
  );

  const selectedPeriodIndex = useMemo(
    () => periodOptions.findIndex((option) => option.key === selectedPeriodKey),
    [periodOptions, selectedPeriodKey],
  );

  const trailingPeriods = useMemo(
    () =>
      selectedPeriodIndex > 0
        ? periodOptions.slice(Math.max(0, selectedPeriodIndex - 3), selectedPeriodIndex)
        : [],
    [periodOptions, selectedPeriodIndex],
  );

  const trailingAverage = useMemo(() => {
    if (!trailingPeriods.length) {
      return 0;
    }

    const totals = trailingPeriods.map((period) => {
      const { start: periodStart, end: periodEnd } = period.range();
      return calculateRangeTotal(periodStart, periodEnd);
    });

    return totals.reduce((acc, value) => acc + value, 0) / totals.length;
  }, [calculateRangeTotal, trailingPeriods]);

  const breakdown = useMemo(() => {
    const fallbackLabel = categoryType === "income" ? "Uncategorized Income" : "Uncategorized Expense";
    const map = new Map<string, number>();

    categoryTransactions.forEach((transaction) => {
      const label = transaction.category?.trim().length ? transaction.category : fallbackLabel;
      map.set(label, (map.get(label) ?? 0) + transaction.amount);
    });

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const slices: CategorySlice[] = [];
    const rows: CategorySlice[] = [];
    let remainingTotal = 0;

    sorted.forEach(([label, value], index) => {
      const color = chartPalette[index % chartPalette.length];
      const percentage = totalAmount ? Math.round((value / totalAmount) * 100) : 0;
      if (index < 6) {
        slices.push({ label, value, percentage, color });
      } else {
        remainingTotal += value;
      }
      rows.push({ label, value, percentage, color });
    });

    if (remainingTotal > 0 && totalAmount) {
      const percentage = Math.max(1, Math.round((remainingTotal / totalAmount) * 100));
      slices.push({ label: "Other", value: remainingTotal, percentage, color: theme.colors.textMuted });
    }

    return { slices, rows };
  }, [categoryTransactions, categoryType, theme.colors.textMuted, totalAmount]);

  const comparisonDelta = totalAmount - trailingAverage;

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
        <Text style={styles.title}>{title}</Text>
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
                  <Text style={styles.periodChipHint}>{`${optionStart.format("MMM D")} – ${optionEnd.format("MMM D")}`}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.summaryCard(theme)}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.overline}>Total</Text>
              <Text style={styles.totalValue(categoryType === "income")}>
                {formatCurrency(totalAmount, currency)}
              </Text>
            </View>
            <View style={styles.pill(categoryType === "income")}> 
              <Text style={styles.pillLabel(categoryType === "income")}>
                {categoryType === "income" ? "Income" : "Expense"}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard(theme)}>
              <Text style={styles.metricLabel}>Daily average</Text>
              <Text style={styles.metricValue}>{formatCurrency(dailyAverage, currency, { maximumFractionDigits: 2 })}</Text>
              <Text style={styles.metricHint}>{`${start.format("MMM D")} – ${end.format("MMM D")}`}</Text>
            </View>
            <View style={styles.metricCard(theme)}>
              <Text style={styles.metricLabel}>3-Month avg</Text>
              <Text style={styles.metricValue}>{formatCurrency(trailingAverage, currency)}</Text>
              <Text style={styles.metricDelta(comparisonDelta >= 0)}>
                {comparisonDelta >= 0 ? "Above" : "Below"} recent average by {formatCurrency(Math.abs(comparisonDelta), currency)}
              </Text>
            </View>
          </View>

          {selectedAccountId && (
            <View style={styles.accountRow}>
              <Ionicons name="wallet" size={16} color={theme.colors.textMuted} />
              <Text style={styles.accountLabel} numberOfLines={1}>
                {accounts.find((account) => account.id === selectedAccountId)?.name ?? "Selected account"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chartCard(theme)}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.sectionTitle}>Category breakdown</Text>
              <Text style={styles.sectionSubtitle}>
                Distribution of {categoryType === "income" ? "income" : "spending"} for this period
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.legendLabel}>Top categories</Text>
            </View>
          </View>

          <View style={styles.breakdownRow}>
            <PieChart data={breakdown.slices} theme={theme} size={170} />
            <View style={styles.legend}>{renderLegend(breakdown.slices, currency, theme)}</View>
          </View>

          {!breakdown.rows.length ? (
            <Text style={styles.emptyState}>No data for this period.</Text>
          ) : (
            <View style={styles.list}>
              {breakdown.rows.map((item) => (
                <View key={`${item.label}-${item.color}`} style={styles.listRow}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${item.color}26` }]}> 
                    <Text style={styles.categoryInitial}>{item.label.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.listMeta}>
                    <Text style={styles.listLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.listHint}>{item.percentage}% of total</Text>
                  </View>
                  <Text style={styles.listAmount}>{formatCurrency(item.value, currency)}</Text>
                </View>
              ))}
            </View>
          )}
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
      marginBottom: theme.spacing.sm,
    },
    periodChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}10`,
      marginRight: theme.spacing.sm,
      minWidth: 120,
      gap: 2,
    },
    periodChipActive: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      borderColor: currentTheme.colors.primary,
      backgroundColor: `${currentTheme.colors.primary}18`,
    }),
    periodChipLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    periodChipLabelActive: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      color: currentTheme.colors.primary,
    }),
    periodChipHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    summaryCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      gap: currentTheme.spacing.md,
    }),
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    totalValue: (positive: boolean) => ({
      fontSize: 32,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    metricsRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    metricCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      flex: 1,
      minWidth: 160,
      padding: currentTheme.spacing.md,
      borderRadius: currentTheme.radii.md,
      backgroundColor: currentTheme.colors.surfaceElevated,
      gap: 6,
    }),
    metricLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    metricHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    metricDelta: (positive: boolean) => ({
      fontSize: 12,
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    accountLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    chartCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      gap: currentTheme.spacing.lg,
    }),
    chartHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },
    legendLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    breakdownRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
      alignItems: "center",
      flexWrap: "wrap",
    },
    legend: {
      flex: 1,
      minWidth: 180,
    },
    emptyState: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    list: {
      gap: 10,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: 6,
    },
    categoryIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    listMeta: {
      flex: 1,
      gap: 2,
    },
    listLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    listHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    listAmount: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    pill: (positive: boolean) => ({
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.md,
      backgroundColor: positive ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
    }),
    pillLabel: (positive: boolean) => ({
      fontSize: 12,
      fontWeight: "700",
      color: positive ? theme.colors.success : theme.colors.danger,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    }),
  });
