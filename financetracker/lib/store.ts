import { create } from "zustand";

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  date: string; // ISO string
}

interface Profile {
  name: string;
  currency: string;
}

interface FinanceState {
  profile: Profile;
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  updateProfile: (payload: Partial<Profile>) => void;
}

const now = new Date();

const daysAgo = (amount: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - amount);
  return date.toISOString();
};

const seedTransactions: Transaction[] = [
  {
    id: "t-1",
    amount: 2450,
    note: "Freelance design retainer",
    type: "income",
    category: "Work",
    date: daysAgo(2),
  },
  {
    id: "t-2",
    amount: 68,
    note: "Night ramen with friends",
    type: "expense",
    category: "Food",
    date: daysAgo(1),
  },
  {
    id: "t-3",
    amount: 120,
    note: "New keyboard",
    type: "expense",
    category: "Gear",
    date: daysAgo(4),
  },
  {
    id: "t-4",
    amount: 3200,
    note: "Product design salary",
    type: "income",
    category: "Salary",
    date: daysAgo(6),
  },
  {
    id: "t-5",
    amount: 42,
    note: "Morning coffee run",
    type: "expense",
    category: "Food",
    date: daysAgo(0),
  },
  {
    id: "t-6",
    amount: 180,
    note: "Dance event tickets",
    type: "expense",
    category: "Lifestyle",
    date: daysAgo(3),
  },
  {
    id: "t-7",
    amount: 520,
    note: "Sold old camera lens",
    type: "income",
    category: "Side Hustle",
    date: daysAgo(8),
  },
];

let uid = seedTransactions.length + 1;

export const useFinanceStore = create<FinanceState>((set) => ({
  profile: {
    name: "Avery Rivera",
    currency: "USD",
  },
  transactions: seedTransactions,
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [
        {
          id: `t-${uid++}`,
          ...transaction,
        },
        ...state.transactions,
      ],
    })),
  updateProfile: (payload) =>
    set((state) => ({
      profile: {
        ...state.profile,
        ...payload,
      },
    })),
}));
