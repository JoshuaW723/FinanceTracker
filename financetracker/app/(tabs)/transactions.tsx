import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs, { type Dayjs } from "dayjs";

import { useAppTheme } from "../../theme";
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

interface PeriodOption {
  key: string;
  label: string;
  range: () => { start: Dayjs; end: Dayjs };
}

const MONTHS_TO_DISPLAY = 12;

const buildMonthlyPeriods = (): PeriodOption[] => {
  const currentMonth = dayjs().startOf("month");

  return Array.from({ length: MONTHS_TO_DISPLAY }).map((_, index) => {
    const month = currentMonth.subtract(MONTHS_TO_DISPLAY - 1 - index, "month");
    const start = month.startOf("month");
    const end = month.endOf("month");

    return {
      key: month.format("YYYY-MM"),
      label: month.format("MMM YYYY"),
      range: () => ({ start, end }),
    };
  });
};

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const recurringTransactions = useFinanceStore((state) => state.recurringTransactions);
  const logRecurringTransaction = useFinanceStore((state) => state.logRecurringTransaction);

  const periodOptions = useMemo(() => buildMonthlyPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const lastPeriod = periodOptions[periodOptions.length - 1];
    return lastPeriod?.key ?? "";
  });
  const [reportExpanded, setReportExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDraftSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSelectedCategories([]);
    setStartDate(null);
    setEndDate(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const openSearch = (showFilters = false) => {
    setDraftSearchTerm(searchTerm);
    setFiltersExpanded(showFilters);
    setSearchVisible(true);
  };

  const closeSearch = () => {
    setSearchVisible(false);
    setDraftSearchTerm(searchTerm);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const handleSearchSubmit = (term: string) => {
    const nextTerm = term.trim();
    setSearchTerm(nextTerm);
    if (nextTerm.length) {
      setSearchHistory((prev) => [nextTerm, ...prev.filter((item) => item !== nextTerm)].slice(0, 6));
    }
    setSearchVisible(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const removeFilter = (type: "search" | "min" | "max" | "start" | "end" | "category", value?: string) => {
    if (type === "search") {
      setSearchTerm("");
      setDraftSearchTerm("");
      return;
    }
    if (type === "min") {
      setMinAmount("");
      return;
    }
    if (type === "max") {
      setMaxAmount("");
      return;
    }
    if (type === "start") {
      setStartDate(null);
      return;
    }
    if (type === "end") {
      setEndDate(null);
      return;
    }
    if (type === "category" && value) {
      setSelectedCategories((prev) => prev.filter((item) => item !== value));
    }
  };

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; type: Parameters<typeof removeFilter>[0]; value?: string }[] = [];
    if (searchTerm) {
      filters.push({ key: `search-${searchTerm}`, label: `“${searchTerm}”`, type: "search" });
    }
    if (minAmount.trim()) {
      filters.push({ key: "min", label: `Min ${minAmount}`, type: "min" });
    }
    if (maxAmount.trim()) {
      filters.push({ key: "max", label: `Max ${maxAmount}`, type: "max" });
    }
    if (startDate) {
      filters.push({ key: "start", label: `From ${startDate.format("MMM D")}`, type: "start" });
    }
    if (endDate) {
      filters.push({ key: "end", label: `To ${endDate.format("MMM D")}`, type: "end" });
    }
    selectedCategories.forEach((category) => {
      filters.push({ key: `category-${category}`, label: category, type: "category", value: category });
    });
    return filters;
  }, [endDate, maxAmount, minAmount, searchTerm, selectedCategories, startDate]);

  const hasActiveFilters = activeFilters.length > 0;

  const { sections, summary, expenseBreakdown, periodLabel, filteredRecurring } = useMemo(() => {
    const fallback = {
      key: dayjs().format("YYYY-MM"),
      label: dayjs().format("MMM YYYY"),
      range: () => ({ start: dayjs().startOf("month"), end: dayjs().endOf("month") }),
    } satisfies PeriodOption;
    const period = periodOptions.find((option) => option.key === selectedPeriod) ?? fallback;
    const { start, end } = period.range();

    const minAmountValue = Number(minAmount) || 0;
    const maxAmountValue = Number(maxAmount) || Number.POSITIVE_INFINITY;
    const lowerBound = minAmount.trim() ? minAmountValue : 0;
    const upperBound = maxAmount.trim() ? maxAmountValue : Number.POSITIVE_INFINITY;

    const withinRange = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      if (date.isBefore(start) || date.isAfter(end)) {
        return false;
      }

      if (startDate && date.isBefore(startDate)) {
        return false;
      }

      if (endDate && date.isAfter(endDate)) {
        return false;
      }

      const amount = transaction.amount;
      if (amount < lowerBound || amount > upperBound) {
        return false;
      }

      if (selectedCategories.length && !selectedCategories.includes(transaction.category)) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchesNote = transaction.note.toLowerCase().includes(query);
        const matchesCategory = transaction.category.toLowerCase().includes(query);
        const numericQuery = query.replace(/[^0-9.]/g, "");
        const matchesAmount = numericQuery
          ? transaction.amount.toString().includes(numericQuery)
          : false;
        if (!matchesNote && !matchesCategory && !matchesAmount) {
          return false;
        }
      }

      return true;
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

    const filteredRecurring = recurringTransactions.filter((recurring) => {
      const occurrence = dayjs(recurring.nextOccurrence);
      return !occurrence.isBefore(start) && !occurrence.isAfter(end);
    });

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
      periodLabel: period.label,
      filteredRecurring,
    };
  }, [
    endDate,
    maxAmount,
    minAmount,
    periodOptions,
    recurringTransactions,
    searchTerm,
    selectedPeriod,
    selectedCategories,
    startDate,
    transactions,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingBlock}>
              <Text style={styles.title}>Transactions</Text>
              <Text style={styles.subtitle}>
                Review, search, and report on your cash flow.
              </Text>
            </View>
            <View style={styles.periodTabs}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodTabsContent}
            >
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
              </ScrollView>
            </View>

            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchTrigger}
                onPress={() => openSearch(false)}
                accessibilityRole="button"
              >
                <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                <View style={styles.searchCopy}>
                  <Text style={styles.searchTitle}>Search</Text>
                  <Text style={styles.searchSubtitle}>
                    {searchTerm ? `“${searchTerm}”` : "Search transactions"}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
                onPress={() => openSearch(true)}
                accessibilityRole="button"
                accessibilityLabel="Open filters"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={hasActiveFilters ? theme.colors.primary : theme.colors.text}
                />
              </Pressable>
            </View>

            {hasActiveFilters && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersRow}
            >
                {activeFilters.map((filter) => (
                  <Pressable
                    key={filter.key}
                    style={styles.activeFilterChip}
                    onPress={() => removeFilter(filter.type, filter.value)}
                    accessibilityRole="button"
                    accessibilityHint="Remove filter"
                  >
                    <Text style={styles.activeFilterText}>{filter.label}</Text>
                    <Ionicons name="close" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                ))}
                <Pressable
                  style={styles.resetFiltersButton}
                  onPress={() => {
                    clearFilters();
                    setFiltersExpanded(false);
                  }}
                >
                  <Text style={styles.resetFiltersText}>Reset</Text>
                </Pressable>
              </ScrollView>
            )}

            <View style={[theme.components.card, styles.summaryCard]}>
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
                      backgroundColor:
                        summary.net >= 0 ? "rgba(52,211,153,0.12)" : "rgba(251,113,133,0.12)",
                    },
                  ]}
                >
                  <Ionicons
                    name={summary.net >= 0 ? "trending-up" : "trending-down"}
                    size={16}
                    color={summary.net >= 0 ? theme.colors.success : theme.colors.danger}
                  />
                  <Text
                    style={[
                      styles.netBadgeText,
                      { color: summary.net >= 0 ? theme.colors.success : theme.colors.danger },
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
                  color={theme.colors.text}
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

            {filteredRecurring.length > 0 && (
              <View style={[theme.components.surface, styles.recurringCard]}>
                <View style={styles.recurringHeader}>
                  <Text style={styles.recurringTitle}>Recurring this period</Text>
                  <Text style={styles.recurringCaption}>{filteredRecurring.length} due</Text>
                </View>
                <View style={styles.recurringList}>
                  {filteredRecurring.map((item) => (
                    <View key={item.id} style={styles.recurringRow}>
                      <View style={styles.recurringCopy}>
                        <Text style={styles.recurringNote}>{item.note}</Text>
                        <Text style={styles.recurringMeta}>
                          {dayjs(item.nextOccurrence).format("MMM D")} •
                          {` ${item.frequency.charAt(0).toUpperCase()}${item.frequency.slice(1)}`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => logRecurringTransaction(item.id)}
                        style={styles.recurringAction}
                        accessibilityRole="button"
                      >
                        <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.recurringActionText}>Log</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filters or logging a new one.</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[theme.components.surface, styles.transactionCard]}>
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
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
      />

      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSearch}
      >
        <SafeAreaView style={styles.searchModal}>
          <View style={styles.searchModalHeader}>
            <Pressable
              onPress={closeSearch}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close search"
            >
              <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
            <Text style={styles.searchModalTitle}>Search for transaction</Text>
            <Pressable
              onPress={() => setFiltersExpanded((prev) => !prev)}
              style={[styles.modalIconButton, filtersExpanded && styles.modalIconButtonActive]}
              accessibilityRole="button"
              accessibilityLabel="Toggle advanced filters"
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={filtersExpanded ? theme.colors.primary : theme.colors.text}
              />
            </Pressable>
          </View>

          <View style={styles.searchInputRow}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} />
            <TextInput
              value={draftSearchTerm}
              onChangeText={setDraftSearchTerm}
              placeholder="Search by note, category, or amount"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchTextInput}
              returnKeyType="search"
              onSubmitEditing={() => handleSearchSubmit(draftSearchTerm)}
              autoFocus
            />
            {draftSearchTerm.length > 0 && (
              <Pressable
                onPress={() => setDraftSearchTerm("")}
                style={styles.clearSearchButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>

          {searchHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Recent searches</Text>
              {searchHistory.map((entry) => (
                <Pressable
                  key={entry}
                  style={styles.historyRow}
                  onPress={() => handleSearchSubmit(entry)}
                  accessibilityRole="button"
                >
                  <Ionicons name="time-outline" size={18} color={theme.colors.textMuted} />
                  <Text style={styles.historyText}>{entry}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {filtersExpanded && (
            <ScrollView
              style={styles.filtersSheet}
              contentContainerStyle={styles.filtersSheetContent}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="automatic"
            >
              <View style={styles.sheetRow}>
                <View style={styles.sheetColumn}>
                  <Text style={styles.sheetLabel}>Min amount</Text>
                  <TextInput
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.sheetInput}
                  />
                </View>
                <View style={styles.sheetColumn}>
                  <Text style={styles.sheetLabel}>Max amount</Text>
                  <TextInput
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="numeric"
                    placeholder="Any"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.sheetInput}
                  />
                </View>
              </View>

              <View style={styles.sheetRow}>
                <View style={styles.sheetColumn}>
                  <Text style={styles.sheetLabel}>Start date</Text>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    style={styles.sheetDateButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sheetDateText}>
                      {startDate ? startDate.format("MMM D, YYYY") : "Any"}
                    </Text>
                    <Ionicons name="calendar" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.sheetColumn}>
                  <Text style={styles.sheetLabel}>End date</Text>
                  <Pressable
                    onPress={() => setShowEndPicker(true)}
                    style={styles.sheetDateButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sheetDateText}>
                      {endDate ? endDate.format("MMM D, YYYY") : "Any"}
                    </Text>
                    <Ionicons name="calendar" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.sheetColumn}>
                <Text style={styles.sheetLabel}>Categories</Text>
                <View style={styles.sheetCategoryRow}>
                  {categories.map((category) => {
                    const active = selectedCategories.includes(category);
                    return (
                      <Pressable
                        key={category}
                        onPress={() => toggleCategory(category)}
                        style={[styles.sheetCategoryChip, active && styles.sheetCategoryChipActive]}
                      >
                        <Text
                          style={[styles.sheetCategoryText, active && styles.sheetCategoryTextActive]}
                        >
                          {category}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.searchModalFooter}>
            <Pressable
              style={styles.modalSecondaryButton}
              onPress={() => {
                clearFilters();
                setDraftSearchTerm("");
                setFiltersExpanded(true);
              }}
            >
              <Text style={styles.modalSecondaryText}>Clear all</Text>
            </Pressable>
            <Pressable
              style={styles.modalPrimaryButton}
              onPress={() => handleSearchSubmit(draftSearchTerm)}
            >
              <Text style={styles.modalPrimaryText}>Search</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {showStartPicker && (
        <DateTimePicker
          value={(startDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) {
              setStartDate(dayjs(selectedDate));
            }
            if (Platform.OS !== "ios") {
              setShowStartPicker(false);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={(endDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) {
              setEndDate(dayjs(selectedDate));
            }
            if (Platform.OS !== "ios") {
              setShowEndPicker(false);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.lg,
    },
    header: {
      gap: theme.spacing.md,
    },
    headingBlock: {
      gap: theme.spacing.xs,
    },
    title: {
      ...theme.typography.title,
    },
    subtitle: {
      ...theme.typography.subtitle,
    },
    periodTabs: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xs,
      borderRadius: 999,
      alignSelf: "stretch",
    },
    periodTabsContent: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
      paddingHorizontal: theme.spacing.xs,
    },
    periodTab: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: 999,
    },
    periodTabActive: {
      backgroundColor: theme.colors.primary,
    },
    periodText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    periodTextActive: {
      color: theme.colors.text,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    searchTrigger: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },
    searchCopy: {
      flex: 1,
      gap: 2,
    },
    searchTitle: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: theme.colors.textMuted,
    },
    searchSubtitle: {
      ...theme.typography.body,
      fontWeight: "600",
      color: theme.colors.text,
    },
    filterButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
    },
    activeFiltersRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    activeFilterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    activeFilterText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    resetFiltersButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryMuted,
    },
    resetFiltersText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    searchModal: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.lg,
    },
    searchModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.lg,
    },
    modalCloseButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    modalCloseText: {
      ...theme.typography.subtitle,
      fontSize: 14,
      color: theme.colors.text,
    },
    searchModalTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
      textAlign: "center",
    },
    modalIconButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalIconButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
    },
    searchInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchTextInput: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
    },
    clearSearchButton: {
      padding: 4,
    },
    historySection: {
      gap: theme.spacing.sm,
    },
    historyTitle: {
      ...theme.typography.label,
      color: theme.colors.textMuted,
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    historyText: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    filtersSheet: {
      flex: 1,
    },
    filtersSheetContent: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xl + insets.bottom,
    },
    sheetRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    sheetColumn: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    sheetLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    sheetInput: {
      ...theme.components.input,
      fontSize: 14,
    },
    sheetDateButton: {
      ...theme.components.input,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sheetDateText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    sheetCategoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    sheetCategoryChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    sheetCategoryChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryMuted,
    },
    sheetCategoryText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    sheetCategoryTextActive: {
      color: theme.colors.primary,
    },
    searchModalFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    modalSecondaryButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSecondaryText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalPrimaryButton: {
      flex: 1,
      ...theme.components.buttonPrimary,
    },
    modalPrimaryText: {
      ...theme.components.buttonPrimaryText,
    },
    sectionHeader: {
      ...theme.typography.label,
      marginBottom: theme.spacing.xs,
    },
    summaryCard: {
      gap: theme.spacing.md,
    },
    summaryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    summaryTitleBlock: {
      gap: 6,
    },
    summaryLabel: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    summaryValue: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    netBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    summaryStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    summaryStat: {
      flex: 1,
      gap: theme.spacing.xs,
      alignItems: "flex-start",
    },
    statLabel: {
      ...theme.typography.subtitle,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1,
      textAlign: "left",
    },
    statValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    openingBalanceValue: {
      color: theme.colors.text,
    },
    incomeText: {
      color: theme.colors.success,
    },
    expenseText: {
      color: theme.colors.danger,
    },
    reportToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    reportToggleText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    reportCard: {
      gap: theme.spacing.md,
    },
    reportTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    reportRow: {
      gap: theme.spacing.xs,
    },
    reportLabelBlock: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    reportCategory: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    reportAmount: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    reportProgressTrack: {
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 999,
      overflow: "hidden",
    },
    reportProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    reportPercentage: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    reportEmpty: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    transactionCard: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    transactionMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    categoryAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarIncome: {
      backgroundColor: `${theme.colors.success}33`,
    },
    avatarExpense: {
      backgroundColor: `${theme.colors.danger}33`,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionCopy: {
      flex: 1,
      gap: 2,
    },
    transactionNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    transactionMeta: {
      ...theme.typography.subtitle,
      fontSize: 11,
    },
    transactionAmountBlock: {
      justifyContent: "center",
      alignItems: "flex-end",
    },
    transactionAmount: {
      fontSize: 15,
      fontWeight: "600",
      textAlign: "right",
    },
    itemSeparator: {
      height: theme.spacing.xs,
    },
    sectionSeparator: {
      height: theme.spacing.md,
    },
    emptyState: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
    },
    emptyTitle: {
      ...theme.typography.title,
      fontSize: 20,
    },
    emptySubtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
      textAlign: "center",
    },
    recurringCard: {
      gap: theme.spacing.md,
    },
    recurringHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    recurringTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    recurringCaption: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recurringList: {
      gap: theme.spacing.sm,
    },
    recurringRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    recurringCopy: {
      flex: 1,
      gap: 4,
    },
    recurringNote: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    recurringMeta: {
      ...theme.typography.subtitle,
      fontSize: 12,
    },
    recurringAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    recurringActionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });
