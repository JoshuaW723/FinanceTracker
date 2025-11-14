import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import {
  Account,
  AccountType,
  ThemeMode,
  TransactionType,
  useFinanceStore,
} from "../../lib/store";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
const goalPeriods = ["month", "week"] as const;
const accountTypes: AccountType[] = ["cash", "bank", "card", "investment"];
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

export default function AccountScreen() {
  const theme = useAppTheme();
  const profile = useFinanceStore((state) => state.profile);
  const updateProfile = useFinanceStore((state) => state.updateProfile);
  const themeMode = useFinanceStore((state) => state.preferences.themeMode);
  const setThemeMode = useFinanceStore((state) => state.setThemeMode);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const addBudgetGoal = useFinanceStore((state) => state.addBudgetGoal);
  const removeBudgetGoal = useFinanceStore((state) => state.removeBudgetGoal);
  const accounts = useFinanceStore((state) => state.accounts);
  const addAccount = useFinanceStore((state) => state.addAccount);
  const updateAccountAction = useFinanceStore((state) => state.updateAccount);
  const archiveAccount = useFinanceStore((state) => state.archiveAccount);

  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.currency);
  const [newCategory, setNewCategory] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<(typeof goalPeriods)[number]>("month");
  const [goalCategory, setGoalCategory] = useState<string | null>(null);
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>("expense");
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormType, setAccountFormType] = useState<AccountType>("bank");

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  useEffect(() => {
    setName(profile.name);
    setCurrency(profile.currency);
  }, [profile.name, profile.currency]);

  const handleSaveProfile = () => {
    if (!name.trim()) {
      Alert.alert("Heads up", "Please add a display name.");
      return;
    }

    if (!currency.trim()) {
      Alert.alert("Heads up", "Currency cannot be empty.");
      return;
    }

    updateProfile({ name: name.trim(), currency: currency.trim().toUpperCase() });
    Alert.alert("Saved", "Profile updated successfully.");
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      Alert.alert("Heads up", "Add a category label before saving.");
      return;
    }

    const value = newCategory.trim();
    addCategory({ name: value, type: newCategoryType });
    setGoalCategory(value);
    setNewCategory("");
    setNewCategoryType("expense");
  };

  const handleCreateGoal = () => {
    if (!goalName.trim()) {
      Alert.alert("Heads up", "Give your goal a descriptive name.");
      return;
    }

    const targetValue = Number(goalTarget);
    if (!goalTarget.trim() || Number.isNaN(targetValue) || targetValue <= 0) {
      Alert.alert("Heads up", "Target amount must be a positive number.");
      return;
    }

    addBudgetGoal({
      name: goalName.trim(),
      target: targetValue,
      period: goalPeriod,
      category: goalCategory || null,
    });

    setGoalName("");
    setGoalTarget("");
  };

  const openAccountModal = (account?: Account) => {
    if (account) {
      setEditingAccountId(account.id);
      setAccountFormName(account.name);
      setAccountFormType(account.type);
    } else {
      setEditingAccountId(null);
      setAccountFormName("");
      setAccountFormType("bank");
    }
    setAccountModalVisible(true);
  };

  const handleCloseAccountModal = () => {
    setAccountModalVisible(false);
    setEditingAccountId(null);
    setAccountFormName("");
    setAccountFormType("bank");
  };

  const handleSaveAccount = () => {
    if (!accountFormName.trim()) {
      Alert.alert("Heads up", "Give the account a name first.");
      return;
    }

    if (editingAccountId) {
      updateAccountAction(editingAccountId, {
        name: accountFormName,
        type: accountFormType,
      });
    } else {
      addAccount({ name: accountFormName, type: accountFormType });
    }

    handleCloseAccountModal();
  };

  const handleToggleArchive = (account: Account) => {
    archiveAccount(account.id, !account.isArchived);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Account & preferences</Text>
            <Text style={styles.subtitle}>Personalize how your finance world looks.</Text>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Profile name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your display name"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Currency</Text>
              <View style={styles.currencyRow}>
                <TextInput
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="USD"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="characters"
                  style={[styles.input, styles.currencyInput]}
                />
                <View style={styles.chipsRow}>
                  {currencies.map((code) => {
                    const isActive = currency.toUpperCase() === code;
                    return (
                      <Pressable
                        key={code}
                        onPress={() => setCurrency(code)}
                        style={[styles.currencyChip, isActive && styles.currencyChipActive]}
                      >
                        <Text style={[styles.currencyChipText, isActive && styles.currencyChipTextActive]}>
                          {code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <Pressable style={styles.primaryButton} onPress={handleSaveProfile}>
              <Text style={styles.primaryButtonText}>Save profile</Text>
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Theme</Text>
            <View style={styles.themeRow}>
              {(["dark", "light"] as ThemeMode[]).map((mode) => {
                const active = themeMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                    onPress={() => setThemeMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={mode === "dark" ? "moon" : "sunny"}
                      size={18}
                      color={active ? theme.colors.text : theme.colors.textMuted}
                    />
                    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                      {mode === "dark" ? "Dark" : "Light"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Accounts</Text>
                <Text style={styles.sectionSubtitle}>Organize wallets and track balances.</Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => openAccountModal()}>
                <Ionicons name="add" size={16} color={theme.colors.text} />
                <Text style={styles.secondaryButtonText}>Add</Text>
              </Pressable>
            </View>
            {accounts.length === 0 ? (
              <Text style={[styles.helperText, styles.emptyStateText]}>
                Add your first account to start tracking balances.
              </Text>
            ) : (
              <View style={styles.accountsList}>
                {accounts.map((account) => (
                  <View
                    key={account.id}
                    style={[styles.accountRow, account.isArchived && styles.archivedAccount]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountMeta}>
                        {ACCOUNT_TYPE_LABELS[account.type]} • {formatCurrency(account.balance, profile.currency)}
                        {account.isArchived ? " • Archived" : ""}
                      </Text>
                    </View>
                    <View style={styles.accountActions}>
                      <Pressable
                        onPress={() => openAccountModal(account)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                      >
                        <Ionicons name="create-outline" size={18} color={theme.colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggleArchive(account)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={account.isArchived ? "refresh" : "archive-outline"}
                          size={18}
                          color={account.isArchived ? theme.colors.success : theme.colors.text}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Custom categories</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Add new category</Text>
              <View style={styles.row}>
                <TextInput
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholder="e.g. Wellness"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, styles.flex]}
                />
                <Pressable style={styles.secondaryButton} onPress={handleAddCategory}>
                  <Text style={styles.secondaryButtonText}>Add</Text>
                </Pressable>
              </View>
              <View style={styles.themeRow}>
                {(["expense", "income"] as TransactionType[]).map((type) => {
                  const active = newCategoryType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.themeChip, active && styles.themeChipActive]}
                      onPress={() => setNewCategoryType(type)}
                    >
                      <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                        {type === "expense" ? "Expense" : "Income"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.chipCloud}>
              {categories.map((category) => (
                <View key={category.id} style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{category.name}</Text>
                  <Text style={styles.categoryTypeBadge}>
                    {category.type === "expense" ? "Expense" : "Income"}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Budget goals</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Goal name</Text>
              <TextInput
                value={goalName}
                onChangeText={setGoalName}
                placeholder="Save $500 this month"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>Target amount</Text>
                <TextInput
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>
              <View style={[styles.fieldGroup, styles.periodField]}>
                <Text style={styles.label}>Period</Text>
                <View style={styles.themeRow}>
                  {goalPeriods.map((period) => {
                    const active = goalPeriod === period;
                    return (
                      <Pressable
                        key={period}
                        style={[styles.themeChip, active && styles.themeChipActive]}
                        onPress={() => setGoalPeriod(period)}
                      >
                        <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                          {period}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Track category (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Pressable
                  key="all"
                  onPress={() => setGoalCategory(null)}
                  style={[styles.currencyChip, goalCategory === null && styles.currencyChipActive]}
                >
                  <Text style={[styles.currencyChipText, goalCategory === null && styles.currencyChipTextActive]}>
                    Savings goal
                  </Text>
                </Pressable>
                {categories.map((category) => {
                  const active = goalCategory === category.name;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setGoalCategory(category.name)}
                      style={[styles.currencyChip, active && styles.currencyChipActive]}
                    >
                      <Text
                        style={[styles.currencyChipText, active && styles.currencyChipTextActive]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Pressable style={styles.primaryButton} onPress={handleCreateGoal}>
              <Text style={styles.primaryButtonText}>Create goal</Text>
            </Pressable>

            <View style={styles.goalList}>
              {budgetGoals.length ? (
                budgetGoals.map((goal) => (
                  <View key={goal.id} style={styles.goalRow}>
                    <View style={styles.goalCopy}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        Target: {goal.target.toLocaleString()} • Period: {goal.period}
                        {goal.category ? ` • Category: ${goal.category}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeBudgetGoal(goal.id)}
                      style={styles.deleteButton}
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash" size={16} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyStateText}>No goals yet. Create one to stay motivated.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={accountModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseAccountModal}
      >
        <SafeAreaView style={[styles.accountModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingAccountId ? "Edit account" : "Add account"}
            </Text>
            <Pressable style={styles.modalClose} onPress={handleCloseAccountModal}>
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.accountModalBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Account name</Text>
              <TextInput
                value={accountFormName}
                onChangeText={setAccountFormName}
                placeholder="Vacation savings"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.accountTypeRow}>
                {accountTypes.map((type) => {
                  const active = accountFormType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.accountTypeChip, active && styles.accountTypeChipActive]}
                      onPress={() => setAccountFormType(type)}
                    >
                      <Text
                        style={[styles.accountTypeChipText, active && styles.accountTypeChipTextActive]}
                      >
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={handleCloseAccountModal}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleSaveAccount}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.xl,
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title,
      fontSize: 26,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    sectionCard: {
      gap: theme.spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    sectionTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    input: {
      ...theme.components.input,
      fontSize: 16,
    },
    currencyRow: {
      gap: theme.spacing.md,
    },
    currencyInput: {
      letterSpacing: 3,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    currencyChip: {
      ...theme.components.chip,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    currencyChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    currencyChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    currencyChipTextActive: {
      color: theme.colors.text,
    },
    accountsList: {
      gap: theme.spacing.md,
    },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    archivedAccount: {
      opacity: 0.6,
    },
    accountName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    accountMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    accountActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginLeft: theme.spacing.md,
    },
    iconButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    emptyStateText: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: theme.spacing.sm,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.xl,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    secondaryButton: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: "center",
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    themeRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    themeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    themeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    themeChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "capitalize",
    },
    themeChipTextActive: {
      color: theme.colors.text,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    chipCloud: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    categoryPill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 100,
      gap: 2,
    },
    categoryPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    categoryTypeBadge: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    periodField: {
      maxWidth: 150,
    },
    goalList: {
      gap: theme.spacing.md,
    },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    goalCopy: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    goalName: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    goalMeta: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    deleteButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    accountModal: {
      flex: 1,
    },
    accountModalBody: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    accountTypeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    accountTypeChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    accountTypeChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}22`,
    },
    accountTypeChipText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    accountTypeChipTextActive: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.md,
    },
  });
