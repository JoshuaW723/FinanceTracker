import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AccountType, selectActiveAccounts, useFinanceStore } from "../../lib/store";
import { useAppTheme } from "../../theme";

interface AccountPickerProps {
  label: string;
  value?: string | null;
  onChange: (accountId: string) => void;
  placeholder?: string;
  helperText?: string;
  excludeAccountIds?: string[];
  allowArchived?: boolean;
  currency: string;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  investment: "Investment",
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

export function AccountPicker({
  label,
  value,
  onChange,
  placeholder = "Choose an account",
  helperText,
  excludeAccountIds,
  allowArchived = false,
  currency,
}: AccountPickerProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const accounts = useFinanceStore(allowArchived ? (state) => state.accounts : selectActiveAccounts);

  const filteredAccounts = useMemo(() => {
    if (!excludeAccountIds?.length) {
      return accounts;
    }

    return accounts.filter((account) => !excludeAccountIds.includes(account.id));
  }, [accounts, excludeAccountIds]);

  const selectedAccount = accounts.find((account) => account.id === value);

  const handleSelect = (accountId: string) => {
    onChange(accountId);
    setModalVisible(false);
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Pressable
        style={[styles.trigger, theme.components.inputSurface]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.triggerText, !selectedAccount && styles.placeholderText]}>
          {selectedAccount ? selectedAccount.name : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>
      {selectedAccount ? (
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
          {`${ACCOUNT_TYPE_LABELS[selectedAccount.type]} • ${formatCurrency(selectedAccount.balance, currency)}`}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>{helperText}</Text>
      ) : null}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{label}</Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {filteredAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="wallet" size={32} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No accounts yet</Text>
                <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                  Create a new account from settings to start logging transactions.
                </Text>
              </View>
            ) : (
              filteredAccounts.map((account) => {
                const active = account.id === value;
                return (
                  <Pressable
                    key={account.id}
                    style={[styles.accountRow, active && { borderColor: theme.colors.primary }]}
                    onPress={() => handleSelect(account.id)}
                  >
                    <View style={styles.accountInfo}>
                      <Text style={[styles.accountName, { color: theme.colors.text }]}>{account.name}</Text>
                      <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]}>
                        {`${ACCOUNT_TYPE_LABELS[account.type]} • ${formatCurrency(account.balance, currency)}`}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            style={[styles.manageButton, theme.components.surface]}
            onPress={() => {
              setModalVisible(false);
              router.push("/(tabs)/account");
            }}
          >
            <Ionicons name="settings" size={16} color={theme.colors.text} />
            <Text style={[styles.manageButtonText, { color: theme.colors.text }]}>Manage accounts</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  trigger: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: 16,
    flex: 1,
  },
  placeholderText: {
    color: "#999",
  },
  helperText: {
    fontSize: 13,
    marginTop: 6,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalClose: {
    padding: 8,
  },
  modalContent: {
    padding: 24,
    gap: 12,
  },
  accountRow: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "600",
  },
  accountMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  manageButton: {
    margin: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
