import { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import dayjs from "dayjs";

import { useAppTheme } from "../../theme";
import { useFinanceStore, type TransactionType } from "../../lib/store";

const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);

export default function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const currency = useFinanceStore((state) => state.profile.currency);
  const transaction = useFinanceStore((state) =>
    state.transactions.find((item) => item.id === id),
  );
  const duplicateTransaction = useFinanceStore((state) => state.duplicateTransaction);
  const removeTransaction = useFinanceStore((state) => state.removeTransaction);
  const accounts = useFinanceStore((state) => state.accounts);

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => map.set(account.id, account.name));
    return map;
  }, [accounts]);

  const resolveAccountName = (accountId?: string | null) => {
    if (!accountId) {
      return "Unassigned account";
    }
    return accountLookup.get(accountId) ?? "Unknown account";
  };

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Transaction not found</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>The transaction you’re looking for no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDuplicate = () => {
    duplicateTransaction(transaction.id);
    Alert.alert("Duplicated", "We copied this transaction for you.");
  };

  const handleDelete = () => {
    Alert.alert("Delete transaction", "This action can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeTransaction(transaction.id);
          router.back();
        },
      },
    ]);
  };

  const participants = transaction.participants ?? [];
  const photos = transaction.photos ?? [];
  const isTransfer = transaction.type === "transfer";
  const fromAccountName = resolveAccountName(transaction.accountId);
  const toAccountName = isTransfer ? resolveAccountName(transaction.toAccountId) : null;
  const typeIcon = transaction.type === "income"
    ? "trending-up"
    : transaction.type === "expense"
      ? "trending-down"
      : "swap-horizontal";
  const typeLabel = transaction.type === "transfer"
    ? "Transfer"
    : transaction.type === "income"
      ? "Income"
      : "Expense";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Transaction details</Text>
        <Pressable
          onPress={() => router.push(`/transactions/${transaction.id}/edit`)}
          style={styles.iconButton}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amount(transaction.type)}>
              {formatCurrency(transaction.amount, currency || "USD")}
            </Text>
            <View style={styles.typeBadge(transaction.type)}>
              <Ionicons name={typeIcon} size={14} color={theme.colors.text} />
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
          </View>
          <View style={styles.summaryMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="pricetag" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{transaction.category}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{dayjs(transaction.date).format("MMM D, YYYY")}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="wallet" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metaLabel}>{isTransfer ? "From" : "Account"}</Text>
              <Text style={styles.metaValue}>{fromAccountName}</Text>
            </View>
            {isTransfer && (
              <View style={styles.metaRow}>
                <Ionicons name="swap-horizontal" size={16} color={theme.colors.textMuted} />
                <Text style={styles.metaLabel}>To</Text>
                <Text style={styles.metaValue}>{toAccountName}</Text>
              </View>
            )}
          </View>
          {transaction.excludeFromReports && (
            <View style={styles.excludedBanner}>
              <Ionicons name="eye-off" size={16} color={theme.colors.textMuted} />
              <Text style={styles.excludedText}>Excluded from reports</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <Text style={styles.sectionBody}>{transaction.note}</Text>
        </View>

        {participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>With</Text>
            <View style={styles.chipRow}>
              {participants.map((person) => (
                <View key={person} style={styles.chip}>
                  <Text style={styles.chipText}>{person}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {transaction.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionBody}>{transaction.location}</Text>
          </View>
        )}

        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, index) => (
                <Image key={`${uri}-${index}`} source={{ uri }} style={styles.photo} contentFit="cover" />
              ))}
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push(`/transactions/${transaction.id}/edit`)}
          >
            <Ionicons name="create" size={18} color={theme.colors.background} />
            <Text style={styles.primaryButtonText}>Edit transaction</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleDuplicate}>
            <Ionicons name="copy" size={18} color={theme.colors.text} />
            <Text style={styles.secondaryButtonText}>Duplicate</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={handleDelete}>
            <Ionicons name="trash" size={18} color={theme.colors.background} />
            <Text style={styles.dangerButtonText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerSpacer: {
      width: 36,
    },
    title: {
      ...theme.typography.title,
      fontSize: 20,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.lg,
    },
    summaryCard: {
      ...theme.components.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    amount: (type: TransactionType) => ({
      fontSize: 28,
      fontWeight: "700",
      color:
        type === "income"
          ? theme.colors.success
          : type === "expense"
            ? theme.colors.danger
            : theme.colors.text,
    }),
    typeBadge: (type: TransactionType) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor:
        type === "income"
          ? `${theme.colors.success}22`
          : type === "expense"
            ? `${theme.colors.danger}22`
            : `${theme.colors.primary}22`,
    }),
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    summaryMeta: {
      gap: theme.spacing.sm,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    metaLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    metaValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    excludedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.border}66`,
      alignSelf: "flex-start",
    },
    excludedText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    section: {
      gap: theme.spacing.xs,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    sectionBody: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    photo: {
      width: 96,
      height: 96,
      borderRadius: theme.radii.md,
    },
    actions: {
      gap: theme.spacing.sm,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    secondaryButton: {
      ...theme.components.buttonSecondary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    secondaryButtonText: {
      ...theme.components.buttonSecondaryText,
    },
    dangerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.danger,
    },
    dangerButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.background,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
    },
    emptyText: {
      fontSize: 15,
      textAlign: "center",
      color: theme.colors.textMuted,
    },
  });
