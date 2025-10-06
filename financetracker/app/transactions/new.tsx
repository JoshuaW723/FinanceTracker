import { useRouter } from "expo-router";

import { TransactionForm } from "../../components/transactions/TransactionForm";
import { useFinanceStore } from "../../lib/store";

export default function NewTransactionModal() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  return (
    <TransactionForm
      title="Add transaction"
      submitLabel="Add transaction"
      onCancel={() => router.back()}
      onSubmit={(transaction) => {
        addTransaction(transaction);
        router.back();
      }}
    />
  );
}
