import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { buildMonthlyPeriods } from "../../lib/periods";
import { filterTransactionsByAccount } from "../../lib/transactions";

dayjs.extend(isoWeek);

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

interface Params {
  type?: string;
  category?: string;
  period?: string;
  accountId?: string;
}

interface CategoryOption {
  label: string;
  value: number;
  color: string;
}

interface WeeklySummary {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
  label: string;
  total: number;
}

export default function CategoryReportScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { type: typeParam, category: categoryParam, period: periodParam, accountId } =
    useLocalSearchParams<Params>();
  const periodScrollerRef = useRef<ScrollView | null>(null);

  const categoryType = typeParam === "income" ? "income" : "expense";
  const title = `${categoryType === "income" ? "Income" : "Expense"} category report`;

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

  const fallbackCategory = categoryType === "income" ? "Uncategorized Income" : "Uncategorized Expense";

  const categoryOptions = useMemo(() => {
    const map = new Map<string, number>();

    withinPeriodTransactions
      .filter((transaction) => transaction.type === categoryType)
      .forEach((transaction) => {
        const label = transaction.category?.trim().length ? transaction.category : fallbackCategory;
        map.set(label, (map.get(label) ?? 0) + transaction.amount);
      });

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

    return sorted.map<CategoryOption>(([label, value], index) => ({
      label,
      value,
      color: chartPalette[index % chartPalette.length],
    }));
  }, [categoryType, fallbackCategory, withinPeriodTransactions]);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const initial = typeof categoryParam === "string" && categoryParam.length ? categoryParam : null;
    return initial ?? categoryOptions[0]?.label ?? fallbackCategory;
  });
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  useEffect(() => {
    if (!categoryOptions.length) return;
    const exists = categoryOptions.some((option) => option.label === selectedCategory);
    if (!exists) {
      setSelectedCategory(categoryOptions[0]?.label ?? fallbackCategory);
    }
  }, [categoryOptions, fallbackCategory, selectedCategory]);

  const selectedCategoryColor = useMemo(
    () => categoryOptions.find((option) => option.label === selectedCategory)?.color ?? theme.colors.primary,
    [categoryOptions, selectedCategory, theme.colors.primary],
  );

  const selectedCategoryTotal = useMemo(
    () =>
      withinPeriodTransactions
        .filter((transaction) => transaction.type === categoryType)
        .filter((transaction) => {
          const label = transaction.category?.trim().length ? transaction.category : fallbackCategory;
          return label === selectedCategory;
        })
        .reduce((acc, transaction) => acc + transaction.amount, 0),
    [categoryType, fallbackCategory, selectedCategory, withinPeriodTransactions],
  );

  const daysInPeriod = useMemo(() => Math.max(end.diff(start, "day") + 1, 1), [end, start]);
  const dailyAverage = selectedCategoryTotal / daysInPeriod;

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

  const calculateRangeTotal = useMemo(
    () =>
      (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) =>
        reportableTransactions.reduce((acc, transaction) => {
          if (transaction.type !== categoryType) {
            return acc;
          }
          const date = dayjs(transaction.date);
          const label = transaction.category?.trim().length ? transaction.category : fallbackCategory;
          if (label !== selectedCategory || date.isBefore(rangeStart) || date.isAfter(rangeEnd)) {
            return acc;
          }
          return acc + transaction.amount;
        }, 0),
    [categoryType, fallbackCategory, reportableTransactions, selectedCategory],
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

  const comparisonDelta = selectedCategoryTotal - trailingAverage;
  const isFavorableDelta = categoryType === "income" ? comparisonDelta >= 0 : comparisonDelta <= 0;

  const weeks = useMemo(() => buildWeeksForMonth(start, end), [start, end]);

  const weeklySummaries: WeeklySummary[] = useMemo(
    () =>
      weeks.map((range) => {
        const total = withinPeriodTransactions
          .filter((transaction) => transaction.type === categoryType)
          .filter((transaction) => {
            const label = transaction.category?.trim().length ? transaction.category : fallbackCategory;
            const date = dayjs(transaction.date);
            return (
              label === selectedCategory && !date.isBefore(range.start) && !date.isAfter(range.end)
            );
          })
          .reduce((acc, transaction) => acc + transaction.amount, 0);

        const label = `${range.start.date()}–${range.end.date()}`;

        return {
          start: range.start,
          end: range.end,
          label,
          total,
        };
      }),
    [categoryType, fallbackCategory, selectedCategory, weeks, withinPeriodTransactions],
  );

  const maxWeeklyTotal = Math.max(...weeklySummaries.map((week) => Math.abs(week.total)), 0);
  const weekScale = maxWeeklyTotal || 1;

  const handleOpenWeek = (week: WeeklySummary) => {
    router.push({
      pathname: "/transactions/net-income-week",
      params: {
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        accountId: selectedAccountId ?? "",
        period: selectedPeriodKey,
        category: selectedCategory,
        type: categoryType,
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
                  <Text style={styles.periodChipHint}>{`${optionStart.format("MMM D")} – ${optionEnd.format(
                    "MMM D",
                  )}`}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.summaryCard(theme)}>
          <View style={styles.cardHeader}>
            <View style={styles.headerSpacer} />
            <View style={styles.pill(categoryType === "income")}>
              <Text style={styles.pillLabel(categoryType === "income")}> 
                {categoryType === "income" ? "Income" : "Expense"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setIsCategoryMenuOpen((prev) => !prev)}
            style={styles.compactCategorySelector(theme)}
            accessibilityRole="button"
            accessibilityLabel="Choose category"
          >
            <Text style={styles.overline}>Category</Text>
            <View style={styles.dropdownRow}>
              <Text style={styles.categoryName} numberOfLines={1}>
                {selectedCategory}
              </Text>
              <Ionicons
                name={isCategoryMenuOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.colors.textMuted}
              />
            </View>
          </Pressable>

          {isCategoryMenuOpen && (
            <View style={styles.dropdownMenu(theme)}>
              {!categoryOptions.length ? (
                <Text style={styles.emptyState}>No category activity in this period.</Text>
              ) : (
                categoryOptions.map((option) => {
                  const active = option.label === selectedCategory;
                  return (
                    <Pressable
                      key={option.label}
                      onPress={() => {
                        setSelectedCategory(option.label);
                        setIsCategoryMenuOpen(false);
                      }}
                      style={[
                        styles.dropdownOption(theme),
                        active && styles.dropdownOptionActive(option.color, theme),
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${option.label}`}
                    >
                      <View style={[styles.pickerDot, { backgroundColor: option.color }]} />
                      <Text
                        style={[styles.dropdownLabel, active && styles.pickerNameActive(option.color)]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.dropdownValue}>{formatCurrency(option.value, currency)}</Text>
                      {active && <Ionicons name="checkmark" size={16} color={option.color} />}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          <Text style={styles.totalValue(categoryType === "income")}>
            {formatCurrency(selectedCategoryTotal, currency)}
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard(theme)}>
              <Text style={styles.metricLabel}>Daily average</Text>
              <Text style={styles.metricValue}>{formatCurrency(dailyAverage, currency, { maximumFractionDigits: 2 })}</Text>
              <Text style={styles.metricHint}>{`${start.format("MMM D")} – ${end.format("MMM D")}`}</Text>
            </View>
            <View style={styles.metricCard(theme)}>
              <Text style={styles.metricLabel}>3-Month avg</Text>
              <Text style={styles.metricValue}>{formatCurrency(trailingAverage, currency)}</Text>
              <Text style={styles.metricDelta(isFavorableDelta)}>
                {comparisonDelta >= 0 ? "Above" : "Below"} recent average by {formatCurrency(
                  Math.abs(comparisonDelta),
                  currency,
                )}
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

        <View style={styles.weekCard(theme)}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Weekly breakdown</Text>
              <Text style={styles.sectionSubtitle}>Tap a week to view its transactions</Text>
            </View>
            <View style={[styles.categoryIconSmall, { backgroundColor: `${selectedCategoryColor}22` }]}>
              <Text style={[styles.categoryInitial, { color: selectedCategoryColor }]}>
                {selectedCategory.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          {!weeklySummaries.length || maxWeeklyTotal === 0 ? (
            <Text style={styles.emptyState}>No weekly activity in this period.</Text>
          ) : (
            <View style={styles.list}>
              {weeklySummaries.map((week) => {
                const fraction = Math.min(1, Math.abs(week.total) / weekScale);
                return (
                  <Pressable
                    key={week.label}
                    onPress={() => handleOpenWeek(week)}
                    style={styles.weekRow(theme)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open week ${week.label}`}
                  >
                    <View style={styles.weekMeta}>
                      <Text style={styles.weekLabel}>{week.label}</Text>
                      <Text style={styles.weekHint}>{`${week.start.format("MMM D")} – ${week.end.format("MMM D")}`}</Text>
                    </View>

                    <View style={styles.weekValueColumn}>
                      <View style={styles.weekBarTrack}>
                        <View
                          style={[
                            styles.weekBarFill,
                            {
                              backgroundColor: selectedCategoryColor,
                              width: `${fraction * 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.weekAmount}>{formatCurrency(week.total, currency)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
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
      gap: theme.spacing.md,
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    categoryIconSmall: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    compactCategorySelector: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      paddingVertical: currentTheme.spacing.sm,
      paddingHorizontal: currentTheme.spacing.md,
      borderRadius: currentTheme.radii.md,
      borderWidth: 1,
      borderColor: `${currentTheme.colors.border}80`,
      backgroundColor: currentTheme.colors.surfaceElevated,
      gap: currentTheme.spacing.xs,
    }),
    dropdownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    dropdownMenu: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      marginTop: currentTheme.spacing.xs,
      borderRadius: currentTheme.radii.lg,
      borderWidth: 1,
      borderColor: `${currentTheme.colors.border}70`,
      backgroundColor: currentTheme.colors.surface,
      overflow: "hidden",
    }),
    dropdownOption: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: currentTheme.spacing.sm,
      paddingHorizontal: currentTheme.spacing.md,
      paddingVertical: currentTheme.spacing.sm,
      borderBottomWidth: 1,
      borderColor: `${currentTheme.colors.border}60`,
    }),
    dropdownOptionActive: (color: string, currentTheme: ReturnType<typeof useAppTheme>) => ({
      backgroundColor: `${color}12`,
      borderColor: `${color}70`,
    }),
    dropdownLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    dropdownValue: {
      fontSize: 13,
      color: theme.colors.textMuted,
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
    pickerDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    pickerNameActive: (color: string) => ({
      color,
    }),
    weekCard: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      ...currentTheme.components.card,
      gap: currentTheme.spacing.md,
    }),
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    list: {
      gap: 10,
    },
    weekRow: (currentTheme: ReturnType<typeof useAppTheme>) => ({
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: currentTheme.spacing.md,
      paddingVertical: currentTheme.spacing.sm,
      borderBottomWidth: 1,
      borderColor: `${currentTheme.colors.border}60`,
    }),
    weekMeta: {
      flex: 1,
      gap: 2,
    },
    weekLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    weekValueColumn: {
      alignItems: "flex-end",
      gap: 6,
      minWidth: 140,
    },
    weekBarTrack: {
      width: "100%",
      height: 10,
      borderRadius: 999,
      backgroundColor: `${theme.colors.border}60`,
      overflow: "hidden",
    },
    weekBarFill: {
      height: "100%",
      borderRadius: 999,
    },
    weekAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyState: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  });
