import { create } from "zustand";

export type TransactionType = "income" | "expense" | "transfer";

export type AccountType = "cash" | "bank" | "card" | "investment";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  initialBalance: number;
  currency: string;
  excludeFromTotal?: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  date: string; // ISO string (date only in practice)
  accountId: string;
  toAccountId?: string | null;
  participants?: string[];
  location?: string;
  photos?: string[];
  excludeFromReports?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food-expense", name: "Food", type: "expense" },
  { id: "cat-groceries-expense", name: "Groceries", type: "expense" },
  { id: "cat-dining-expense", name: "Dining", type: "expense" },
  { id: "cat-lifestyle-expense", name: "Lifestyle", type: "expense" },
  { id: "cat-fitness-expense", name: "Fitness", type: "expense" },
  { id: "cat-travel-expense", name: "Travel", type: "expense" },
  { id: "cat-transport-expense", name: "Transport", type: "expense" },
  { id: "cat-home-expense", name: "Home", type: "expense" },
  { id: "cat-bills-expense", name: "Bills", type: "expense" },
  { id: "cat-gear-expense", name: "Gear", type: "expense" },
  { id: "cat-creativity-expense", name: "Creativity", type: "expense" },
  { id: "cat-outdoors-expense", name: "Outdoors", type: "expense" },
  { id: "cat-work-expense", name: "Work Expenses", type: "expense" },
  { id: "cat-entertainment-expense", name: "Entertainment", type: "expense" },
  { id: "cat-pets-expense", name: "Pets", type: "expense" },
  { id: "cat-family-expense", name: "Family", type: "expense" },
  { id: "cat-health-expense", name: "Health", type: "expense" },
  { id: "cat-education-expense", name: "Education", type: "expense" },
  { id: "cat-utilities-expense", name: "Utilities", type: "expense" },
  { id: "cat-rent-expense", name: "Rent", type: "expense" },
  { id: "cat-side-hustle-income", name: "Side Hustle", type: "income" },
  { id: "cat-client-work-income", name: "Client Work", type: "income" },
  { id: "cat-salary-income", name: "Salary", type: "income" },
  { id: "cat-consulting-income", name: "Consulting", type: "income" },
  { id: "cat-resale-income", name: "Resale", type: "income" },
  { id: "cat-creative-sales-income", name: "Creative Sales", type: "income" },
  { id: "cat-investing-income", name: "Investing", type: "income" },
  { id: "cat-bonus-income", name: "Bonus", type: "income" },
  { id: "cat-dividends-income", name: "Dividends", type: "income" },
];

export type ThemeMode = "light" | "dark";

export interface RecurringTransaction {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  accountId: string;
  toAccountId?: string | null;
  frequency: "weekly" | "biweekly" | "monthly";
  nextOccurrence: string;
  isActive: boolean;
}

export interface BudgetGoal {
  id: string;
  name: string;
  target: number;
  period: "week" | "month";
  category?: string | null;
}

interface Profile {
  name: string;
  currency: string;
}

interface Preferences {
  themeMode: ThemeMode;
  categories: Category[];
}

export interface FinanceState {
  profile: Profile;
  preferences: Preferences;
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  budgetGoals: BudgetGoal[];
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, "id">>,
  ) => void;
  removeTransaction: (id: string) => void;
  duplicateTransaction: (id: string) => void;
  addRecurringTransaction: (
    transaction: Omit<RecurringTransaction, "id" | "nextOccurrence"> & {
      nextOccurrence: string;
    },
  ) => void;
  toggleRecurringTransaction: (id: string, active?: boolean) => void;
  logRecurringTransaction: (id: string) => void;
  addBudgetGoal: (goal: Omit<BudgetGoal, "id">) => void;
  updateBudgetGoal: (id: string, updates: Partial<Omit<BudgetGoal, "id">>) => void;
  removeBudgetGoal: (id: string) => void;
  updateProfile: (payload: Partial<Profile>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  addAccount: (
    account: {
      name: string;
      type: AccountType;
      currency?: string;
      initialBalance?: number;
      excludeFromTotal?: boolean;
    },
  ) => void;
  updateAccount: (
    id: string,
    updates: Partial<
      Pick<Account, "name" | "type" | "isArchived" | "currency" | "initialBalance" | "excludeFromTotal">
    >,
  ) => void;
  archiveAccount: (id: string, archived?: boolean) => void;
}

const applyAccountBalanceUpdate = (state: FinanceState, transactions: Transaction[]) => ({
  transactions,
  accounts: recalculateAccountBalances(state.accounts, transactions, state.profile.currency),
});

const now = new Date();
export const DEFAULT_ACCOUNT_ID = "account-main";

const createDefaultAccount = (currency: string): Account => ({
  id: DEFAULT_ACCOUNT_ID,
  name: "Everyday account",
  type: "bank",
  balance: 0,
  initialBalance: 0,
  currency,
  excludeFromTotal: false,
  isArchived: false,
  createdAt: now.toISOString(),
});

const daysAgo = (amount: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - amount);
  return date.toISOString();
};

const ensureAccountAssignments = <T extends { accountId?: string | null }>(
  records: T[],
  fallbackAccountId: string,
) =>
  records.map((record) => ({
    ...record,
    accountId: record.accountId ?? fallbackAccountId,
  }));

const recalculateAccountBalances = (
  accounts: Account[],
  transactions: Transaction[],
  fallbackCurrency: string,
): Account[] => {
  const base = accounts.map((account) => ({
    ...account,
    initialBalance: Number.isFinite(account.initialBalance) ? account.initialBalance : 0,
    currency: account.currency || fallbackCurrency,
    excludeFromTotal: account.excludeFromTotal ?? false,
    balance: Number.isFinite(account.initialBalance) ? account.initialBalance : 0,
  }));
  const extras: Account[] = [];

  const ensureAccount = (accountId?: string | null) => {
    if (!accountId) {
      return undefined;
    }

    let account = base.find((item) => item.id === accountId);
    if (!account) {
      account = extras.find((item) => item.id === accountId);
    }

    if (!account) {
      account = {
        id: accountId,
        name: "Legacy account",
        type: "cash",
        balance: 0,
        initialBalance: 0,
        currency: fallbackCurrency,
        excludeFromTotal: true,
        isArchived: true,
        createdAt: new Date().toISOString(),
      };
      extras.push(account);
    }

    return account;
  };

  transactions.forEach((transaction) => {
    const primary = ensureAccount(transaction.accountId);
    if (!primary) {
      return;
    }

    if (transaction.type === "income") {
      primary.balance += transaction.amount;
    } else if (transaction.type === "expense") {
      primary.balance -= transaction.amount;
    } else if (transaction.type === "transfer") {
      primary.balance -= transaction.amount;
      const destination = ensureAccount(transaction.toAccountId);
      if (destination) {
        destination.balance += transaction.amount;
      }
    }
  });

  return [...base, ...extras];
};

const baseSeedTransactions: Omit<Transaction, "accountId">[] = [
  {
    id: "t-1",
    amount: 38,
    note: "Neighborhood coffee catch-up",
    type: "expense",
    category: "Food",
    date: daysAgo(0),
  },
  {
    id: "t-2",
    amount: 120,
    note: "Weekly groceries restock",
    type: "expense",
    category: "Groceries",
    date: daysAgo(1),
  },
  {
    id: "t-3",
    amount: 450,
    note: "UX consultation session",
    type: "income",
    category: "Side Hustle",
    date: daysAgo(1),
  },
  {
    id: "t-4",
    amount: 68,
    note: "Night ramen with friends",
    type: "expense",
    category: "Food",
    date: daysAgo(2),
  },
  {
    id: "t-5",
    amount: 2450,
    note: "Freelance design retainer",
    type: "income",
    category: "Client Work",
    date: daysAgo(3),
  },
  {
    id: "t-6",
    amount: 52,
    note: "Studio supplies restock",
    type: "expense",
    category: "Creativity",
    date: daysAgo(4),
  },
  {
    id: "t-7",
    amount: 180,
    note: "Dance event tickets",
    type: "expense",
    category: "Lifestyle",
    date: daysAgo(5),
  },
  {
    id: "t-8",
    amount: 3200,
    note: "Product design salary",
    type: "income",
    category: "Salary",
    date: daysAgo(6),
  },
  {
    id: "t-9",
    amount: 42,
    note: "Morning coffee run",
    type: "expense",
    category: "Food",
    date: daysAgo(7),
  },
  {
    id: "t-10",
    amount: 92,
    note: "Climbing gym membership",
    type: "expense",
    category: "Fitness",
    date: daysAgo(8),
  },
  {
    id: "t-11",
    amount: 520,
    note: "Sold old camera lens",
    type: "income",
    category: "Resale",
    date: daysAgo(9),
  },
  {
    id: "t-12",
    amount: 140,
    note: "Dinner date night",
    type: "expense",
    category: "Dining",
    date: daysAgo(11),
  },
  {
    id: "t-13",
    amount: 310,
    note: "Remote workshop facilitation",
    type: "income",
    category: "Consulting",
    date: daysAgo(13),
  },
  {
    id: "t-14",
    amount: 64,
    note: "Co-working day pass",
    type: "expense",
    category: "Work Expenses",
    date: daysAgo(14),
  },
  {
    id: "t-15",
    amount: 215,
    note: "Quarterly insurance premium",
    type: "expense",
    category: "Bills",
    date: daysAgo(17),
  },
  {
    id: "t-16",
    amount: 285,
    note: "E-commerce payout",
    type: "income",
    category: "Side Hustle",
    date: daysAgo(18),
  },
  {
    id: "t-17",
    amount: 75,
    note: "Trailhead brunch",
    type: "expense",
    category: "Food",
    date: daysAgo(20),
  },
  {
    id: "t-18",
    amount: 128,
    note: "Household essentials restock",
    type: "expense",
    category: "Home",
    date: daysAgo(23),
  },
  {
    id: "t-19",
    amount: 60,
    note: "Streaming gear rental",
    type: "expense",
    category: "Gear",
    date: daysAgo(26),
  },
  {
    id: "t-20",
    amount: 3200,
    note: "Product design salary",
    type: "income",
    category: "Salary",
    date: daysAgo(34),
  },
  {
    id: "t-21",
    amount: 275,
    note: "Client milestone bonus",
    type: "income",
    category: "Client Work",
    date: daysAgo(37),
  },
  {
    id: "t-22",
    amount: 88,
    note: "Weekend hike supplies",
    type: "expense",
    category: "Outdoors",
    date: daysAgo(39),
  },
  {
    id: "t-23",
    amount: 145,
    note: "Monthly groceries",
    type: "expense",
    category: "Groceries",
    date: daysAgo(43),
  },
  {
    id: "t-24",
    amount: 310,
    note: "Sold illustration prints",
    type: "income",
    category: "Creative Sales",
    date: daysAgo(46),
  },
  {
    id: "t-25",
    amount: 95,
    note: "Team lunch meetup",
    type: "expense",
    category: "Food",
    date: daysAgo(49),
  },
  {
    id: "t-26",
    amount: 180,
    note: "Photography gear upgrade",
    type: "expense",
    category: "Gear",
    date: daysAgo(52),
  },
  {
    id: "t-27",
    amount: 260,
    note: "UX mentoring session",
    type: "income",
    category: "Consulting",
    date: daysAgo(55),
  },
  {
    id: "t-28",
    amount: 72,
    note: "Monthly transit pass",
    type: "expense",
    category: "Transport",
    date: daysAgo(58),
  },
  {
    id: "t-29",
    amount: 210,
    note: "Weekend getaway deposit",
    type: "expense",
    category: "Travel",
    date: daysAgo(60),
  },
  {
    id: "t-30",
    amount: 540,
    note: "Sold custom shelving",
    type: "income",
    category: "Creative Sales",
    date: daysAgo(62),
  },
  {
    id: "t-31",
    amount: 84,
    note: "Family movie night",
    type: "expense",
    category: "Entertainment",
    date: daysAgo(64),
  },
  {
    id: "t-32",
    amount: 165,
    note: "House cleaner visit",
    type: "expense",
    category: "Home",
    date: daysAgo(66),
  },
  {
    id: "t-33",
    amount: 1300,
    note: "Quarterly dividend payout",
    type: "income",
    category: "Investing",
    date: daysAgo(68),
  },
  {
    id: "t-34",
    amount: 48,
    note: "Yoga studio drop-in",
    type: "expense",
    category: "Fitness",
    date: daysAgo(70),
  },
  {
    id: "t-35",
    amount: 92,
    note: "Monthly book club snacks",
    type: "expense",
    category: "Lifestyle",
    date: daysAgo(72),
  },
  {
    id: "t-36",
    amount: 410,
    note: "UI audit engagement",
    type: "income",
    category: "Consulting",
    date: daysAgo(74),
  },
  {
    id: "t-37",
    amount: 58,
    note: "Vet check-up for Mochi",
    type: "expense",
    category: "Pets",
    date: daysAgo(77),
  },
  {
    id: "t-38",
    amount: 185,
    note: "Weekend farmer’s market",
    type: "expense",
    category: "Groceries",
    date: daysAgo(80),
  },
  {
    id: "t-39",
    amount: 620,
    note: "Brand strategy workshop",
    type: "income",
    category: "Client Work",
    date: daysAgo(83),
  },
  {
    id: "t-40",
    amount: 135,
    note: "Gifts for nieces",
    type: "expense",
    category: "Family",
    date: daysAgo(86),
  },
  {
    id: "t-41",
    amount: 255,
    note: "Annual web hosting",
    type: "expense",
    category: "Work Expenses",
    date: daysAgo(89),
  },
];

const seedTransactions: Transaction[] = ensureAccountAssignments(
  baseSeedTransactions,
  DEFAULT_ACCOUNT_ID,
);

const seededAccounts = recalculateAccountBalances(
  [createDefaultAccount("USD")],
  seedTransactions,
  "USD",
);

let uid = seedTransactions.length + 1;
let accountUid = seededAccounts.length + 1;

const nextOccurrenceForFrequency = (fromDate: string, frequency: RecurringTransaction["frequency"]) => {
  const base = new Date(fromDate);
  if (frequency === "weekly") {
    base.setDate(base.getDate() + 7);
  } else if (frequency === "biweekly") {
    base.setDate(base.getDate() + 14);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString();
};

export const useFinanceStore = create<FinanceState>((set, get) => ({
  profile: {
    name: "Alicia Jeanelly",
    currency: "USD",
  },
  preferences: {
    themeMode: "dark",
    categories: [...DEFAULT_CATEGORIES],
  },
  accounts: seededAccounts,
  transactions: seedTransactions,
  recurringTransactions: [
    {
      id: "r-1",
      amount: 72,
      note: "Coworking membership",
      type: "expense",
      category: "Work Expenses",
      accountId: DEFAULT_ACCOUNT_ID,
      frequency: "monthly",
      nextOccurrence: daysAgo(-5),
      isActive: true,
    },
    {
      id: "r-2",
      amount: 3200,
      note: "Product design salary",
      type: "income",
      category: "Salary",
      accountId: DEFAULT_ACCOUNT_ID,
      frequency: "monthly",
      nextOccurrence: daysAgo(-2),
      isActive: true,
    },
    {
      id: "r-3",
      amount: 45,
      note: "Streaming subscriptions",
      type: "expense",
      category: "Lifestyle",
      accountId: DEFAULT_ACCOUNT_ID,
      frequency: "monthly",
      nextOccurrence: daysAgo(6),
      isActive: true,
    },
  ],
  budgetGoals: [
    {
      id: "g-1",
      name: "Save $500 this month",
      target: 500,
      period: "month",
      category: null,
    },
    {
      id: "g-2",
      name: "Limit dining out to $250",
      target: 250,
      period: "month",
      category: "Dining",
    },
  ],
  addTransaction: (transaction) =>
    set((state) => {
      const normalizedDate = new Date(transaction.date);
      normalizedDate.setHours(0, 0, 0, 0);

      const normalizedParticipants = transaction.participants
        ? transaction.participants.map((person) => person.trim()).filter(Boolean)
        : [];

      const normalizedPhotos = transaction.photos ? transaction.photos.filter(Boolean) : [];

      const normalizedAmount = Math.round(transaction.amount * 100) / 100;
      const normalizedAccountId = transaction.accountId || DEFAULT_ACCOUNT_ID;
      const normalizedToAccountId = transaction.toAccountId || null;
      const normalizedCategory =
        transaction.type === "transfer" ? transaction.category || "Transfer" : transaction.category;

      const payload: Transaction = {
        id: `t-${uid++}`,
        ...transaction,
        category: normalizedCategory,
        participants: normalizedParticipants,
        photos: normalizedPhotos,
        excludeFromReports: Boolean(transaction.excludeFromReports),
        amount: normalizedAmount,
        note: transaction.note.trim(),
        date: normalizedDate.toISOString(),
        accountId: normalizedAccountId,
        toAccountId: transaction.type === "transfer" ? normalizedToAccountId : null,
      };

      const nextTransactions = [payload, ...state.transactions];
      return applyAccountBalanceUpdate(state, nextTransactions);
    }),
  updateTransaction: (id, updates) =>
    set((state) => {
      const nextTransactions = state.transactions.map((transaction) => {
        if (transaction.id !== id) {
          return transaction;
        }

        const next: Transaction = {
          ...transaction,
          ...updates,
        };

        if (updates.note !== undefined) {
          next.note = updates.note.trim();
        }

        if (updates.participants !== undefined) {
          next.participants = updates.participants
            .map((person) => person.trim())
            .filter(Boolean);
        }

        if (updates.photos !== undefined) {
          next.photos = updates.photos.filter(Boolean);
        }

        if (updates.location !== undefined) {
          next.location = updates.location.trim() || undefined;
        }

        if (updates.excludeFromReports !== undefined) {
          next.excludeFromReports = Boolean(updates.excludeFromReports);
        }

        if (updates.amount !== undefined) {
          next.amount = Math.round(updates.amount * 100) / 100;
        }

        if (updates.date !== undefined) {
          const normalized = new Date(updates.date);
          normalized.setHours(0, 0, 0, 0);
          next.date = normalized.toISOString();
        }

        if (updates.accountId !== undefined) {
          next.accountId = updates.accountId || DEFAULT_ACCOUNT_ID;
        }

        if (updates.toAccountId !== undefined) {
          next.toAccountId = updates.toAccountId || null;
        }

        if (updates.type !== undefined && updates.type !== "transfer") {
          next.toAccountId = null;
        }

        if (next.type === "transfer") {
          next.category = next.category || "Transfer";
        }

        return next;
      });

      return applyAccountBalanceUpdate(state, nextTransactions);
    }),
  removeTransaction: (id) =>
    set((state) => {
      const nextTransactions = state.transactions.filter((transaction) => transaction.id !== id);
      return applyAccountBalanceUpdate(state, nextTransactions);
    }),
  duplicateTransaction: (id) => {
    const existing = get().transactions.find((transaction) => transaction.id === id);
    if (!existing) {
      return;
    }

    const copy: Omit<Transaction, "id"> = {
      amount: existing.amount,
      note: existing.note,
      type: existing.type,
      category: existing.category,
      date: existing.date,
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
      participants: existing.participants ? [...existing.participants] : undefined,
      location: existing.location,
      photos: existing.photos ? [...existing.photos] : undefined,
      excludeFromReports: existing.excludeFromReports,
    };

    get().addTransaction(copy);
  },
  addRecurringTransaction: (transaction) =>
    set((state) => {
      const normalizedStart = new Date(transaction.nextOccurrence);
      normalizedStart.setHours(0, 0, 0, 0);
      const startDateIso = normalizedStart.toISOString();

      const alreadyLogged = state.transactions.some(
        (entry) =>
          entry.date === startDateIso &&
          entry.amount === transaction.amount &&
          entry.type === transaction.type &&
          entry.category === transaction.category &&
          entry.note === transaction.note.trim(),
      );

      const nextOccurrence = alreadyLogged
        ? nextOccurrenceForFrequency(startDateIso, transaction.frequency)
        : startDateIso;

      const normalizedAccountId = transaction.accountId || DEFAULT_ACCOUNT_ID;
      const normalizedToAccountId =
        transaction.type === "transfer" ? transaction.toAccountId || null : null;

      return {
        recurringTransactions: [
          ...state.recurringTransactions,
          {
            id: `r-${state.recurringTransactions.length + 1}`,
            ...transaction,
            accountId: normalizedAccountId,
            toAccountId: normalizedToAccountId,
            nextOccurrence,
            isActive: true,
          },
        ],
      };
    }),
  toggleRecurringTransaction: (id, active) =>
    set((state) => ({
      recurringTransactions: state.recurringTransactions.map((item) =>
        item.id === id
          ? {
              ...item,
              isActive: typeof active === "boolean" ? active : !item.isActive,
            }
          : item,
      ),
    })),
  logRecurringTransaction: (id) => {
    const store = get();
    const recurring = store.recurringTransactions.find((item) => item.id === id);
    if (!recurring) {
      return;
    }

    const nextOccurrence = nextOccurrenceForFrequency(recurring.nextOccurrence, recurring.frequency);

    set((state) => {
      const entry: Transaction = {
        id: `t-${uid++}`,
        amount: recurring.amount,
        note: recurring.note,
        type: recurring.type,
        category: recurring.category || (recurring.type === "transfer" ? "Transfer" : ""),
        date: recurring.nextOccurrence,
        accountId: recurring.accountId || DEFAULT_ACCOUNT_ID,
        toAccountId: recurring.type === "transfer" ? recurring.toAccountId || null : null,
      };

      const nextTransactions = [entry, ...state.transactions];
      const accountUpdate = applyAccountBalanceUpdate(state, nextTransactions);

      return {
        ...accountUpdate,
        recurringTransactions: state.recurringTransactions.map((item) =>
          item.id === id
            ? {
                ...item,
                nextOccurrence,
              }
            : item,
        ),
      };
    });
  },
  addBudgetGoal: (goal) =>
    set((state) => ({
      budgetGoals: [
        ...state.budgetGoals,
        {
          id: `g-${state.budgetGoals.length + 1}`,
          ...goal,
        },
      ],
    })),
  updateBudgetGoal: (id, updates) =>
    set((state) => ({
      budgetGoals: state.budgetGoals.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              ...updates,
            }
          : goal,
      ),
    })),
  removeBudgetGoal: (id) =>
    set((state) => ({
      budgetGoals: state.budgetGoals.filter((goal) => goal.id !== id),
    })),
  updateProfile: (payload) =>
    set((state) => ({
      profile: {
        ...state.profile,
        ...payload,
      },
    })),
  setThemeMode: (mode) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        themeMode: mode,
      },
    })),
  addAccount: ({ name, type, currency, initialBalance, excludeFromTotal }) =>
    set((state) => {
      const value = name.trim();
      if (!value) {
        return {};
      }

      const normalizedCurrency = (currency || state.profile.currency || "USD").trim().toUpperCase();
      const parsedInitial = Number.isFinite(initialBalance)
        ? Number(initialBalance)
        : Number(initialBalance ?? 0);
      const normalizedInitial = Number.isFinite(parsedInitial)
        ? Math.round(parsedInitial * 100) / 100
        : 0;

      const nextAccount: Account = {
        id: `account-${accountUid++}`,
        name: value,
        type,
        initialBalance: normalizedInitial,
        balance: normalizedInitial,
        currency: normalizedCurrency,
        excludeFromTotal: Boolean(excludeFromTotal),
        isArchived: false,
        createdAt: new Date().toISOString(),
      };

      const nextAccounts = [...state.accounts, nextAccount];
      return {
        accounts: recalculateAccountBalances(nextAccounts, state.transactions, state.profile.currency),
      };
    }),
  updateAccount: (id, updates) =>
    set((state) => {
      let mutated = false;
      const nextAccounts = state.accounts.map((account) => {
        if (account.id !== id) {
          return account;
        }

        const next: Account = { ...account };
        let changed = false;

        if (updates.name !== undefined) {
          const value = updates.name.trim();
          if (value && value !== account.name) {
            next.name = value;
            changed = true;
          }
        }

        if (updates.type !== undefined && updates.type !== account.type) {
          next.type = updates.type;
          changed = true;
        }

        if (updates.currency !== undefined) {
          const value = updates.currency.trim().toUpperCase();
          if (value && value !== account.currency) {
            next.currency = value;
            changed = true;
          }
        }

        if (updates.initialBalance !== undefined) {
          const normalized = Math.round(updates.initialBalance * 100) / 100;
          if (!Number.isNaN(normalized) && normalized !== account.initialBalance) {
            next.initialBalance = normalized;
            changed = true;
          }
        }

        if (updates.excludeFromTotal !== undefined && updates.excludeFromTotal !== account.excludeFromTotal) {
          next.excludeFromTotal = updates.excludeFromTotal;
          changed = true;
        }

        if (updates.isArchived !== undefined && updates.isArchived !== account.isArchived) {
          next.isArchived = updates.isArchived;
          changed = true;
        }

        if (changed) {
          mutated = true;
          return next;
        }

        return account;
      });

      if (!mutated) {
        return {};
      }

      return {
        accounts: recalculateAccountBalances(nextAccounts, state.transactions, state.profile.currency),
      };
    }),
  archiveAccount: (id, archived = true) => {
    const updateAccount = get().updateAccount;
    updateAccount(id, { isArchived: archived });
  },
  addCategory: (category) => {
    const value = category.name.trim();
    if (!value) {
      return;
    }

    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = `cat-${slug}-${category.type}`;

    const existingCategories = get().preferences.categories;
    const normalizedValue = value.toLowerCase();

    const hasDuplicate = existingCategories.some(
      (existing) =>
        existing.type === category.type && existing.name.trim().toLowerCase() === normalizedValue,
    );

    const hasSlugConflict = existingCategories.some((existing) => existing.id === id);

    if (hasDuplicate || hasSlugConflict) {
      return;
    }

    set((state) => ({
      preferences: {
        ...state.preferences,
        categories: [
          ...state.preferences.categories,
          { id, name: value, type: category.type },
        ],
      },
    }));
  },
}));

export const selectActiveAccounts = (state: FinanceState) =>
  state.accounts.filter((account) => !account.isArchived);

export const selectAccountById = (accountId: string) => (state: FinanceState) =>
  state.accounts.find((account) => account.id === accountId);
