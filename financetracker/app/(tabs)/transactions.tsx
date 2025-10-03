import { useMemo, useState, useRef, useEffect } from "react";
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

const formatPercentage = (current: number, previous: number): string => {
  if (previous === 0) return "—";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
};

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
    return {
      key: month.format("YYYY-MM"),
      label: month.format("MMM YYYY"),
      range: () => ({ 
        start: month.startOf("month"), 
        end: month.endOf("month") 
      }),
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
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Default to current month (last item in array)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const currentMonth = periodOptions[periodOptions.length - 1];
    return currentMonth?.key ?? "";
  });
  
  // Auto-scroll to current month on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);

    return () => clearTimeout(timeout);
  }, []);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [draftSearchTerm, setDraftSearchTerm] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) 
        ? prev.filter((item) => item !== category) 
        : [...prev, category],
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
    setSearchVisible(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; type: string; value?: string }[] = [];
    if (searchTerm) {
      filters.push({ key: `search-${searchTerm}`, label: searchTerm, type: "search" });
    }
    if (minAmount.trim()) {
      filters.push({ key: "min", label: `Min ${formatCurrency(Number(minAmount), currency || "USD")}`, type: "min" });
    }
    if (maxAmount.trim()) {
      filters.push({ key: "max", label: `Max ${formatCurrency(Number(maxAmount), currency || "USD")}`, type: "max" });
    }
    if (startDate) {
      filters.push({ key: "start", label: startDate.format("MMM D"), type: "start" });
    }
    if (endDate) {
      filters.push({ key: "end", label: endDate.format("MMM D"), type: "end" });
    }
    selectedCategories.forEach((category) => {
      filters.push({ key: `cat-${category}`, label: category, type: "category", value: category });
    });
    return filters;
  }, [endDate, maxAmount, minAmount, searchTerm, selectedCategories, startDate, currency]);

  const hasActiveFilters = activeFilters.length > 0;

  const { sections, summary, expenseBreakdown, filteredRecurring } = useMemo(() => {
    const period = periodOptions.find((option) => option.key === selectedPeriod) ?? periodOptions[periodOptions.length - 1];
    const { start, end } = period.range();

    const minAmountValue = Number(minAmount) || 0;
    const maxAmountValue = Number(maxAmount) || Number.POSITIVE_INFINITY;

    const filtered = transactions.filter((transaction) => {
      const date = dayjs(transaction.date);
      
      // Period filter
      if (date.isBefore(start) || date.isAfter(end)) return false;
      
      // Date range filters
      if (startDate && date.isBefore(startDate)) return false;
      if (endDate && date.isAfter(endDate)) return false;
      
      // Amount filters
      const amount = transaction.amount;
      if (minAmount.trim() && amount < minAmountValue) return false;
      if (maxAmount.trim() && amount > maxAmountValue) return false;
      
      // Category filter
      if (selectedCategories.length && !selectedCategories.includes(transaction.category)) {
        return false;
      }
      
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesNote = transaction.note.toLowerCase().includes(query);
        const matchesCategory = transaction.category.toLowerCase().includes(query);
        if (!matchesNote && !matchesCategory) return false;
      }
      
      return true;
    });

    // Group by date with daily totals
    const grouped = new Map<
      string,
      {
        transactions: Transaction[];
        dailyIncome: number;
        dailyExpense: number;
        dailyNet: number;
      }
    >();
    filtered
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((transaction) => {
        const key = dayjs(transaction.date).format("YYYY-MM-DD");
        const existing =
          grouped.get(key) ?? {
            transactions: [],
            dailyIncome: 0,
            dailyExpense: 0,
            dailyNet: 0,
          };
        existing.transactions.push(transaction);
        if (transaction.type === "income") {
          existing.dailyIncome += transaction.amount;
          existing.dailyNet += transaction.amount;
        } else {
          existing.dailyExpense += transaction.amount;
          existing.dailyNet -= transaction.amount;
        }
        grouped.set(key, existing);
      });

    const sectionData = Array.from(grouped.entries()).map(([key, value]) => ({
      title: dayjs(key).format("dddd, MMM D"),
      data: [{ ...value, id: key }],
      dailyIncome: value.dailyIncome,
      dailyExpense: value.dailyExpense,
      dailyNet: value.dailyNet,
    }));

    // Calculate summary
    const totals = filtered.reduce(
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

    // Calculate balances
    let openingBalance = 0;

    [...transactions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((transaction) => {
        const value = transaction.type === "income" ? transaction.amount : -transaction.amount;
        const date = dayjs(transaction.date);

        if (date.isBefore(start)) {
          openingBalance += value;
        }
      });

    const netChange = totals.income - totals.expense;
    const closingBalance = openingBalance + netChange;

    // Expense breakdown
    const expenseMap = filtered.reduce((acc, transaction) => {
      if (transaction.type !== "expense") return acc;
      const current = acc.get(transaction.category) ?? 0;
      acc.set(transaction.category, current + transaction.amount);
      return acc;
    }, new Map<string, number>());

    const breakdown = Array.from(expenseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totals.expense ? Math.round((amount / totals.expense) * 100) : 0,
      }));

    // Recurring transactions
    const recurring = recurringTransactions.filter((item) => {
      const occurrence = dayjs(item.nextOccurrence);
      return !occurrence.isBefore(start) && !occurrence.isAfter(end);
    });

    return {
      sections: sectionData,
      summary: {
        income: totals.income,
        expense: totals.expense,
        net: netChange,
        openingBalance,
        closingBalance,
        percentageChange: formatPercentage(closingBalance, openingBalance),
      },
      expenseBreakdown: breakdown,
      filteredRecurring: recurring,
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
            {/* Primary Balance Display */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <View>
                  <Text style={styles.balanceLabel}>Current Balance</Text>
                  <Text style={styles.balanceValue}>
                    {formatCurrency(summary.closingBalance, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.changeBadge(summary.net)}>
                  <Ionicons
                    name={summary.net >= 0 ? "arrow-up" : "arrow-down"}
                    size={14}
                    color={summary.net >= 0 ? theme.colors.success : theme.colors.danger}
                  />
                  <Text style={styles.changeValue(summary.net)}>
                    {formatCurrency(Math.abs(summary.net), currency || "USD")}
                  </Text>
                  <Text style={styles.changePercent}>
                    {summary.percentageChange}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Income</Text>
                  <Text style={styles.metricValue(theme.colors.success)}>
                    {formatCurrency(summary.income, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Expenses</Text>
                  <Text style={styles.metricValue(theme.colors.danger)}>
                    {formatCurrency(summary.expense, currency || "USD")}
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Previous</Text>
                  <Text style={styles.metricValue(theme.colors.text)}>
                    {formatCurrency(summary.openingBalance, currency || "USD")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Period Selector */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.periodScroll}
              contentContainerStyle={styles.periodContent}
            >
              {periodOptions.map((option) => {
                const active = option.key === selectedPeriod;
                return (
                  <Pressable
                    key={option.key}
                    style={styles.periodChip(active)}
                    onPress={() => setSelectedPeriod(option.key)}
                  >
                    <Text style={styles.periodText(active)}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Search and Filters */}
            <View style={styles.searchContainer}>
              <Pressable
                style={styles.searchField}
                onPress={() => openSearch(false)}
              >
                <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                <Text style={styles.searchPlaceholder}>
                  {searchTerm || "Search transactions..."}
                </Text>
              </Pressable>
              <Pressable
                style={styles.filterButton(hasActiveFilters)}
                onPress={() => openSearch(true)}
              >
                <Ionicons
                  name="filter"
                  size={18}
                  color={hasActiveFilters ? theme.colors.primary : theme.colors.text}
                />
                {hasActiveFilters && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilters.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Active Filters */}
            {hasActiveFilters && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChips}
              >
                {activeFilters.map((filter) => (
                  <View key={filter.key} style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{filter.label}</Text>
                    <Pressable
                      onPress={() => {
                        if (filter.type === "search") setSearchTerm("");
                        else if (filter.type === "min") setMinAmount("");
                        else if (filter.type === "max") setMaxAmount("");
                        else if (filter.type === "start") setStartDate(null);
                        else if (filter.type === "end") setEndDate(null);
                        else if (filter.type === "category" && filter.value) {
                          setSelectedCategories(prev => prev.filter(c => c !== filter.value));
                        }
                      }}
                      style={styles.filterChipClose}
                    >
                      <Ionicons name="close" size={12} color={theme.colors.text} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={clearFilters} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear all</Text>
                </Pressable>
              </ScrollView>
            )}

            {/* Expense Breakdown */}
            {expenseBreakdown.length > 0 && (
              <Pressable 
                style={styles.breakdownCard}
                onPress={() => setCategoriesExpanded(!categoriesExpanded)}
              >
                <View style={styles.breakdownHeader}>
                  <Text style={styles.breakdownTitle}>Top Categories</Text>
                  <Ionicons
                    name={categoriesExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </View>
                {categoriesExpanded && (
                  <View style={styles.breakdownContent}>
                    {expenseBreakdown.map((item) => (
                      <View key={item.category} style={styles.breakdownRow}>
                        <View style={styles.breakdownInfo}>
                          <Text style={styles.breakdownCategory}>{item.category}</Text>
                          <Text style={styles.breakdownAmount}>
                            {formatCurrency(item.amount, currency || "USD")}
                          </Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View style={styles.progressFill(item.percentage)} />
                        </View>
                        <Text style={styles.breakdownPercent}>{item.percentage}%</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            )}

            {/* Recurring Transactions */}
            {filteredRecurring.length > 0 && (
              <View style={styles.recurringSection}>
                <Text style={styles.sectionTitle}>
                  Upcoming Recurring ({filteredRecurring.length})
                </Text>
                {filteredRecurring.map((item) => (
                  <View key={item.id} style={styles.recurringItem}>
                    <View style={styles.recurringInfo}>
                      <Text style={styles.recurringName}>{item.note}</Text>
                      <Text style={styles.recurringDate}>
                        {dayjs(item.nextOccurrence).format("MMM D")} • {item.frequency}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => logRecurringTransaction(item.id)}
                      style={styles.logButton}
                    >
                      <Text style={styles.logButtonText}>Log</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {sections.length > 0 && (
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters 
                ? "Try adjusting your filters" 
                : "Start tracking your expenses"}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const netPrefix = section.dailyNet > 0 ? "+" : section.dailyNet < 0 ? "−" : "";
          return (
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.sectionTotals}>
                <View style={styles.sectionNetPill(section.dailyNet)}>
                  <Text style={styles.sectionNetText(section.dailyNet)}>
                    {netPrefix}
                    {formatCurrency(Math.abs(section.dailyNet), currency || "USD")}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <View style={styles.dayCard}>
            {item.transactions.map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 && <View style={styles.transactionDivider} />}
                <Pressable style={styles.transactionItem}>
                  <View style={styles.transactionLeft}>
                    <View style={styles.categoryIcon(transaction.type)}>
                      <Text style={styles.categoryInitial}>
                        {transaction.category.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionNote} numberOfLines={1}>
                        {transaction.note}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {transaction.category} • {dayjs(transaction.date).format("h:mm A")}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.transactionAmount(transaction.type)}>
                    {transaction.type === "income" ? "+" : "−"}
                    {formatCurrency(transaction.amount, currency || "USD")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Search Modal */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSearch}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeSearch} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Search & Filter</Text>
            <View style={styles.modalSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={theme.colors.textMuted} />
              <TextInput
                value={draftSearchTerm}
                onChangeText={setDraftSearchTerm}
                placeholder="Search notes or categories"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                autoFocus
              />
            </View>

            {filtersExpanded && (
              <View style={styles.filters}>
                <Text style={styles.filterSectionTitle}>Amount Range</Text>
                <View style={styles.filterRow}>
                  <TextInput
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="numeric"
                    placeholder="Min"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                  <Text style={styles.filterSeparator}>to</Text>
                  <TextInput
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="numeric"
                    placeholder="Max"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.filterInput}
                  />
                </View>

                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate ? startDate.format("MMM D") : "Start"}
                    </Text>
                  </Pressable>
                  <Text style={styles.filterSeparator}>to</Text>
                  <Pressable
                    onPress={() => setShowEndPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {endDate ? endDate.format("MMM D") : "End"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.filterSectionTitle}>Categories</Text>
                <View style={styles.categoryGrid}>
                  {categories.map((category) => {
                    const selected = selectedCategories.includes(category);
                    return (
                      <Pressable
                        key={category}
                        onPress={() => toggleCategory(category)}
                        style={styles.categoryOption(selected)}
                      >
                        <Text style={styles.categoryOptionText(selected)}>
                          {category}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setFiltersExpanded(!filtersExpanded)}
              style={styles.toggleFilters}
            >
              <Text style={styles.toggleFiltersText}>
                {filtersExpanded ? "Hide" : "Show"} advanced filters
              </Text>
              <Ionicons
                name={filtersExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.colors.primary}
              />
            </Pressable>
          </View>

          <View style={styles.modalFooter}>
            <Pressable onPress={clearFilters} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSearchSubmit(draftSearchTerm)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Apply</Text>
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
            if (selectedDate) setStartDate(dayjs(selectedDate));
            if (Platform.OS !== "ios") setShowStartPicker(false);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={(endDate ?? dayjs()).toDate()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_, selectedDate) => {
            if (selectedDate) setEndDate(dayjs(selectedDate));
            if (Platform.OS !== "ios") setShowEndPicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingBottom: 100,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    
    // Balance Card
    balanceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    balanceLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    balanceValue: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.text,
    },
    changeBadge: (positive: number) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: positive >= 0 
        ? `${theme.colors.success}15` 
        : `${theme.colors.danger}15`,
    }),
    changeValue: (positive: number) => ({
      fontSize: 14,
      fontWeight: "600",
      color: positive >= 0 ? theme.colors.success : theme.colors.danger,
    }),
    changePercent: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    metric: {
      flex: 1,
      alignItems: "center",
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    metricValue: (color: string) => ({
      fontSize: 16,
      fontWeight: "600",
      color,
    }),
    metricDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
    },
    
    // Period Selector
    periodScroll: {
      marginBottom: 16,
      marginHorizontal: -16,
    },
    periodContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    periodChip: (active: boolean) => ({
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
    }),
    periodText: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: active ? "#fff" : theme.colors.text,
    }),
    
    // Search and Filters
    searchContainer: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    searchField: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchPlaceholder: {
      fontSize: 15,
      color: theme.colors.textMuted,
    },
    filterButton: (active: boolean) => ({
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: active ? theme.colors.primaryMuted : theme.colors.surface,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }),
    filterBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },
    
    // Filter Chips
    filterChips: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    filterChipClose: {
      padding: 2,
    },
    clearButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    
    // Breakdown Card
    breakdownCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    breakdownHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    breakdownTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    breakdownContent: {
      marginTop: 12,
    },
    breakdownRow: {
      marginBottom: 12,
    },
    breakdownInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    breakdownCategory: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    breakdownAmount: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      overflow: "hidden",
      marginBottom: 4,
    },
    progressFill: (percentage: number) => ({
      height: "100%",
      width: `${percentage}%`,
      backgroundColor: theme.colors.primary,
      borderRadius: 2,
    }),
    breakdownPercent: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    
    // Recurring Section
    recurringSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    recurringItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    recurringInfo: {
      flex: 1,
    },
    recurringName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    recurringDate: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    logButton: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
    },
    logButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#fff",
    },
    
    // Transactions List
    transactionsTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 8,
    },
    sectionHeaderContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textMuted,
    },
    sectionTotals: {
      flexDirection: "row",
    },
    sectionNetPill: (net: number) => ({
      backgroundColor:
        net > 0
          ? `${theme.colors.success}25`
          : net < 0
          ? `${theme.colors.danger}25`
          : `${theme.colors.textMuted}25`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    }),
    sectionNetText: (net: number) => ({
      fontSize: 11,
      fontWeight: "700",
      color:
        net > 0
          ? theme.colors.success
          : net < 0
          ? theme.colors.danger
          : theme.colors.textMuted,
      letterSpacing: 0.3,
    }),
    dayCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      overflow: "hidden",
    },
    transactionItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
    },
    transactionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 12,
    },
    transactionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    categoryIcon: (type: string) => ({
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: type === "income" 
        ? `${theme.colors.success}20` 
        : `${theme.colors.danger}20`,
      alignItems: "center",
      justifyContent: "center",
    }),
    categoryInitial: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    transactionDetails: {
      flex: 1,
    },
    transactionNote: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    transactionMeta: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    transactionAmount: (type: string) => ({
      fontSize: 15,
      fontWeight: "700",
      color: type === "income" ? theme.colors.success : theme.colors.danger,
    }),
    separator: {
      height: 8,
    },
    
    // Empty State
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    
    // Modal
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalClose: {
      padding: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalSpacer: {
      width: 32,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    filters: {
      gap: 16,
    },
    filterSectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    filterInput: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      fontSize: 15,
      color: theme.colors.text,
    },
    filterSeparator: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    dateButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    dateButtonText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryOption: (selected: boolean) => ({
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
      borderWidth: 1,
      borderColor: selected ? theme.colors.primary : theme.colors.border,
    }),
    categoryOptionText: (selected: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: selected ? "#fff" : theme.colors.text,
    }),
    toggleFilters: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
    },
    toggleFiltersText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    modalFooter: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    primaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });