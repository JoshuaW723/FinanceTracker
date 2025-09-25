import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { MiniBarChart } from "../../components/MiniBarChart";
import { colors, components, spacing, typography } from "../../theme";
import { useFinanceStore } from "../../lib/store";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export default function HomeScreen() {
  const router = useRouter();
  const transactions = useFinanceStore((state) => state.transactions);
  const profile = useFinanceStore((state) => state.profile);

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
            <View style={styles.metaBadge}>
              <Ionicons name="trending-up" size={16} color={colors.success} />
              <Text style={styles.metaText}>{formatCurrency(netPositive, currency)} net</Text>
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

        <View style={[components.surface, styles.chartCard]}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>7-day cash flow</Text>
            <Text style={styles.chartCaption}>Income vs. spend</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <MiniBarChart data={chartData} style={styles.chart} />
          </ScrollView>
        </View>
      </ScrollView>

      <Pressable accessibilityRole="button" style={styles.fab} onPress={() => router.push("/transactions/new")}> 
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 140,
    gap: spacing.xl,
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
    backgroundColor: "rgba(52,211,153,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.success,
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
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl * 1.2,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
