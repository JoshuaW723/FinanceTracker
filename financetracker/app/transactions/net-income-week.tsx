import { useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";
import { filterTransactionsByAccount, getTransactionVisualState } from "../../lib/transactions";
import { truncateWords } from "../../lib/text";

interface Params {
  start?: string;
  end?: string;
  accountId?: string;
  period?: string;
  category?: string;
  type?: string;
}

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

export default function NetIncomeWeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const { start: startParam, end: endParam, accountId, category, type: typeParam } =
    useLocalSearchParams<Params>();

  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const currency = useFinanceStore((state) => state.profile.currency) || "USD";

  const start = useMemo(() => dayjs(startParam ?? undefined).startOf("day"), [startParam]);
  const end = useMemo(() => dayjs(endParam ?? undefined).endOf("day"), [endParam]);

  const selectedAccountId = typeof accountId === "string" && accountId.length ? accountId : null;
  const categoryFilter = typeof category === "string" && category.length ? category : null;
  const categoryType = typeParam === "expense" || typeParam === "income" ? typeParam : null;

  const fallbackCategory = useMemo(() => {
    if (categoryType === "income") return "Uncategorized Income";
    if (categoryType === "expense") return "Uncategorized Expense";
    return "Uncategorized";
  }, [categoryType]);

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => !account.excludeFromTotal && (account.currency || currency) === currency),
    [accounts, currency],
  );

  const visibleAccountIds = useMemo(() => visibleAccounts.map((account) => account.id), [visibleAccounts]);
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

  const filtered = useMemo(() => {
    if (!start.isValid() || !end.isValid()) {
      return [];
    }

    const withinRange = scopedTransactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      return (
        !transaction.excludeFromReports && !date.isBefore(start) && !date.isAfter(end)
      );
    });

    const typed = categoryType
      ? withinRange.filter((transaction) => transaction.type === categoryType)
      : withinRange;

    if (!categoryFilter) {
      return typed;
    }

    return typed.filter((transaction) => {
      const label = transaction.category?.trim().length ? transaction.category : fallbackCategory;
      return label === categoryFilter;
    });
  }, [categoryFilter, categoryType, end, fallbackCategory, scopedTransactions, start]);

  const groupedSections = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; transactions: typeof filtered; income: number; expense: number; net: number }
    >();

    filtered
      .slice()
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
      .forEach((transaction) => {
        const key = dayjs(transaction.date).format("YYYY-MM-DD");
        const existing =
          grouped.get(key) ?? { title: dayjs(transaction.date).format("dddd, MMM D"), transactions: [], income: 0, expense: 0, net: 0 };

        existing.transactions.push(transaction);
        if (transaction.type === "income") {
          existing.income += transaction.amount;
          existing.net += transaction.amount;
        } else if (transaction.type === "expense") {
          existing.expense += transaction.amount;
          existing.net -= transaction.amount;
        }
        grouped.set(key, existing);
      });

    return Array.from(grouped.values()).map((value) => ({
      title: value.title,
      data: [value],
      income: value.income,
      expense: value.expense,
      net: value.net,
      key: value.title,
    }));
  }, [filtered]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, transaction) => {
          if (transaction.type === "income") {
            acc.income += transaction.amount;
          } else if (transaction.type === "expense") {
            acc.expense += transaction.amount;
          }
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [filtered],
  );

  const net = summary.income - summary.expense;
  const rangeLabel = start.isValid() && end.isValid()
    ? `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`
    : "Selected week";

  const resolveAccountName = (id?: string | null) => {
    if (!id) return "Unassigned account";
    return accounts.find((account) => account.id === id)?.name ?? "Unknown account";
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
        <Text style={styles.title}>Week overview</Text>
        <View style={styles.headerSpacer} />
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.overline}>Range</Text>
                <Text style={styles.rangeValue}>{rangeLabel}</Text>
                <Text style={styles.overline}>Results</Text>
                <Text style={styles.resultValue}>
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={styles.summaryHeaderRight}>
                <View style={styles.netBadge(net >= 0)}>
                  <Text style={styles.netBadgeLabel}>Net</Text>
                  <Text style={styles.netBadgeValue(net >= 0)}>
                    {formatCurrency(net, currency, { signDisplay: "always" })}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricsRow}>
              <View>
                <Text style={styles.metricLabel}>Income</Text>
                <Text style={styles.metricValue(theme.colors.success)}>
                  {formatCurrency(summary.income, currency)}
                </Text>
              </View>
              <View>
                <Text style={styles.metricLabel}>Expense</Text>
                <Text style={styles.metricValue(theme.colors.danger)}>
                  {formatCurrency(summary.expense, currency)}
                </Text>
              </View>
            </View>

            {selectedAccountId && (
              <View style={styles.accountRow}>
                <Ionicons name="wallet" size={16} color={theme.colors.textMuted} />
                <Text style={styles.accountLabel}>{resolveAccountName(selectedAccountId)}</Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionPill(section.net >= 0)}>
              <Text style={styles.sectionPillText(section.net >= 0)}>
                {formatCurrency(section.net, currency, { signDisplay: "always" })}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.dayCard}>
            {item.transactions.map((transaction, index) => {
              const visual = getTransactionVisualState(transaction, selectedAccountId);
              const isTransfer = transaction.type === "transfer";
              const notePreview = transaction.note.trim().length
                ? truncateWords(transaction.note, 10)
                : "No notes";
              const transferLabel = isTransfer
                ? `${resolveAccountName(transaction.accountId)} → ${resolveAccountName(transaction.toAccountId)}`
                : null;

              return (
                <View key={transaction.id}>
                  {index > 0 && <View style={styles.transactionDivider} />}
                  <Pressable
                    onPress={() => router.push(`/transactions/${transaction.id}`)}
                    style={styles.transactionRow}
                    accessibilityRole="button"
                  >
                    <View style={styles.transactionLeft}>
                      <View style={styles.categoryIcon(visual.variant)}>
                        <Text style={styles.categoryInitial}>
                          {transaction.category.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.transactionMeta}>
                        <Text style={styles.transactionCategory} numberOfLines={1}>
                          {transaction.category}
                        </Text>
                        <Text style={styles.transactionNote} numberOfLines={2}>
                          {notePreview}
                        </Text>
                        {transferLabel && (
                          <Text style={styles.transferMeta} numberOfLines={1}>
                            {transferLabel}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text style={styles.transactionAmount(visual.variant)}>
                        {visual.prefix}
                        {formatCurrency(transaction.amount, currency)}
                      </Text>
                      {transaction.excludeFromReports && (
                        <View style={styles.excludedBadge}>
                          <Text style={styles.excludedText}>Excluded</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={42} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptyText}>
              There are no transactions for this week within the selected account and filters.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>, insets: { top: number; bottom: number }) =>
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
    listContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: Math.max(theme.spacing.xl * 2, insets.bottom + theme.spacing.lg),
    },
    summaryCard: {
      ...theme.components.card,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    overline: {
      fontSize: 12,
      color: theme.colors.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    rangeValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    resultValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netBadge: (positive: boolean) => ({
      backgroundColor: positive ? `${theme.colors.success}20` : `${theme.colors.danger}20`,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      alignItems: "flex-end",
      gap: 4,
    }),
    netBadgeLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    netBadgeValue: (positive: boolean) => ({
      fontSize: 20,
      fontWeight: "800",
      color: positive ? theme.colors.success : theme.colors.danger,
    }),
    divider: {
      height: 1,
      backgroundColor: `${theme.colors.border}80`,
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    metricLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    metricValue: (color: string) => ({
      fontSize: 18,
      fontWeight: "700",
      color,
    }),
    accountRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingTop: theme.spacing.sm,
    },
    accountLabel: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    sectionPill: (positive: boolean) => ({
      backgroundColor: positive ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radii.full,
    }),
    sectionPillText: (positive: boolean) => ({
      color: positive ? theme.colors.success : theme.colors.danger,
      fontWeight: "700",
    }),
    dayCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    transactionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    transactionLeft: {
      flexDirection: "row",
      gap: theme.spacing.md,
      flex: 1,
      alignItems: "center",
    },
    categoryIcon: (variant: string) => ({
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        variant === "income"
          ? `${theme.colors.success}20`
          : variant === "expense"
            ? `${theme.colors.danger}20`
            : `${theme.colors.border}55`,
    }),
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionMeta: {
      flex: 1,
      gap: 4,
    },
    transactionCategory: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    transactionNote: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    transferMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    transactionRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    transactionAmount: (variant: string) => ({
      fontSize: 15,
      fontWeight: "700",
      color:
        variant === "income"
          ? theme.colors.success
          : variant === "expense"
            ? theme.colors.danger
            : theme.colors.text,
    }),
    excludedBadge: {
      backgroundColor: `${theme.colors.border}60`,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
    },
    excludedText: {
      fontSize: 12,
      color: theme.colors.text,
    },
    transactionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    separator: {
      height: theme.spacing.sm,
    },
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
