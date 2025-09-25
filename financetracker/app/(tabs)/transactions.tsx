import { useMemo } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";

import { colors, components, spacing, typography } from "../../theme";
import { Transaction, useFinanceStore } from "../../lib/store";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

interface SectionData {
  title: string;
  data: Transaction[];
}

export default function TransactionsScreen() {
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);

  const sections = useMemo<SectionData[]>(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const map = new Map<string, Transaction[]>();

    sorted.forEach((transaction) => {
      const key = dayjs(transaction.date).format("YYYY-MM-DD");
      const existing = map.get(key) ?? [];
      existing.push(transaction);
      map.set(key, existing);
    });

    return Array.from(map.entries()).map(([key, value]) => ({
      title: dayjs(key).format("dddd, MMM D"),
      data: value,
    }));
  }, [transactions]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Transactions</Text>
            <Text style={styles.subtitle}>Grouped neatly by day for quick review.</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[components.surface, styles.itemCard]}>
            <View style={styles.itemLeft}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
              <View style={styles.noteBlock}>
                <Text style={styles.noteText}>{item.note}</Text>
                <Text style={styles.timeText}>{dayjs(item.date).format("h:mm A")}</Text>
              </View>
            </View>
            <Text style={[styles.amount, item.type === "income" ? styles.income : styles.expense]}>
              {item.type === "expense" ? "-" : "+"}
              {formatCurrency(item.amount, currency || "USD")}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 1.5,
  },
  header: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  categoryPill: {
    ...components.chip,
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  noteBlock: {
    gap: 6,
    flexShrink: 1,
  },
  noteText: {
    ...typography.body,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
  },
  income: {
    color: colors.success,
  },
  expense: {
    color: colors.danger,
  },
  separator: {
    height: spacing.lg,
  },
});
