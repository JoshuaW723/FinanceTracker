import { useRouter } from "expo-router";

import { TransactionForm } from "../../components/transactions/TransactionForm";
import { useFinanceStore } from "../../lib/store";

export default function NewTransactionModal() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const addRecurringTransaction = useFinanceStore(
    (state) => state.addRecurringTransaction,
  );

  return (
    <TransactionForm
      title="Add transaction"
      submitLabel="Add transaction"
      onCancel={() => router.back()}
      onSubmit={(transaction) => {
        addTransaction(transaction);
        router.back();
      }}
      enableRecurringOption
      onSubmitRecurring={(transaction, config) => {
        addRecurringTransaction({
          amount: transaction.amount,
          note: transaction.note,
          type: transaction.type,
          category: transaction.category,
          accountId: transaction.accountId,
          toAccountId: transaction.toAccountId,
          frequency: config.frequency,
          nextOccurrence: config.startDate,
          isActive: true,
        });
      }}
    />
  );
}
