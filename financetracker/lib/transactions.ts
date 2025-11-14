import { Transaction } from "./store";

export type TransactionVisualVariant = "income" | "expense" | "neutral";

export interface TransactionVisualState {
  prefix: "" | "+" | "−";
  variant: TransactionVisualVariant;
}

export const filterTransactionsByAccount = (
  transactions: Transaction[],
  accountId: string | null,
): Transaction[] => {
  if (!accountId) {
    return transactions;
  }

  return transactions.filter((transaction) => {
    if (transaction.type === "transfer") {
      return transaction.accountId === accountId || transaction.toAccountId === accountId;
    }
    return transaction.accountId === accountId;
  });
};

export const getTransactionDelta = (transaction: Transaction, accountId: string | null): number => {
  if (transaction.type === "income") {
    return transaction.amount;
  }

  if (transaction.type === "expense") {
    return -transaction.amount;
  }

  if (transaction.type === "transfer") {
    if (!accountId) {
      return 0;
    }

    if (transaction.accountId === accountId) {
      return -transaction.amount;
    }

    if (transaction.toAccountId === accountId) {
      return transaction.amount;
    }

    return 0;
  }

  return 0;
};

export const getTransactionVisualState = (
  transaction: Transaction,
  accountId: string | null,
): TransactionVisualState => {
  if (transaction.type === "income") {
    return { prefix: "+", variant: "income" };
  }

  if (transaction.type === "expense") {
    return { prefix: "−", variant: "expense" };
  }

  const delta = getTransactionDelta(transaction, accountId);

  if (!accountId || delta === 0) {
    return { prefix: "", variant: "neutral" };
  }

  return delta > 0
    ? { prefix: "+", variant: "income" }
    : { prefix: "−", variant: "expense" };
};
