import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { TransactionForm } from "../../../components/transactions/TransactionForm";
import { useAppTheme } from "../../../theme";
import { useFinanceStore } from "../../../lib/store";

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const transaction = useFinanceStore((state) =>
    state.transactions.find((item) => item.id === id),
  );
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);

  if (!transaction) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.fallback}>
          <Text style={[styles.fallbackText, { color: theme.colors.textMuted }]}>
            We couldn’t find that transaction.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TransactionForm
      title="Edit transaction"
      submitLabel="Save changes"
      initialValues={transaction}
      onCancel={() => router.back()}
      onSubmit={(values) => {
        updateTransaction(transaction.id, values);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fallbackText: {
    fontSize: 16,
    textAlign: "center",
  },
});
