import type {
  Account,
  BudgetGoal,
  Category,
  RecurringTransaction,
  ThemeMode,
  Transaction,
  TransactionType,
} from "../store";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

export interface FinanceSnapshotPayload {
  profile?: Partial<{ name: string; currency: string }>;
  preferences?: Partial<{ themeMode: ThemeMode; categories: Category[] }>;
  accounts?: Account[];
  transactions?: Transaction[];
  recurringTransactions?: RecurringTransaction[];
  budgetGoals?: BudgetGoal[];
}

type TransactionRow = {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category: string;
  date: string;
  account_id: string | null;
  to_account_id?: string | null;
  participants?: string[] | null;
  location?: string | null;
  photos?: string[] | null;
  exclude_from_reports?: boolean | null;
};

type AccountRow = {
  id: string;
  name: string;
  type: Account["type"];
  currency?: string | null;
  initial_balance?: number | null;
  exclude_from_total?: boolean | null;
  is_archived?: boolean | null;
  created_at?: string | null;
};

type RecurringTransactionRow = {
  id: string;
  amount: number;
  note: string;
  type: TransactionType;
  category?: string | null;
  account_id?: string | null;
  to_account_id?: string | null;
  frequency: RecurringTransaction["frequency"];
  next_occurrence: string;
  is_active?: boolean | null;
};

type BudgetGoalRow = {
  id: string;
  name: string;
  target: number;
  period: BudgetGoal["period"];
  category?: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  type: TransactionType;
};

type ProfileRow = {
  id?: string;
  name?: string | null;
  currency?: string | null;
  theme_mode?: ThemeMode | null;
};

const mapTransactionRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  amount: row.amount,
  note: row.note,
  type: row.type,
  category: row.category,
  date: row.date,
  accountId: row.account_id ?? "",
  toAccountId: row.to_account_id ?? null,
  participants: Array.isArray(row.participants)
    ? row.participants.filter(Boolean)
    : undefined,
  location: row.location ?? undefined,
  photos: Array.isArray(row.photos) ? row.photos.filter(Boolean) : undefined,
  excludeFromReports: Boolean(row.exclude_from_reports),
});

const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  balance: row.initial_balance ?? 0,
  initialBalance: row.initial_balance ?? 0,
  currency: row.currency || "USD",
  excludeFromTotal: Boolean(row.exclude_from_total),
  isArchived: Boolean(row.is_archived),
  createdAt: row.created_at || new Date().toISOString(),
});

const mapRecurringRow = (row: RecurringTransactionRow): RecurringTransaction => ({
  id: row.id,
  amount: row.amount,
  note: row.note,
  type: row.type,
  category: row.category || "",
  accountId: row.account_id || "",
  toAccountId: row.type === "transfer" ? row.to_account_id || null : null,
  frequency: row.frequency,
  nextOccurrence: row.next_occurrence,
  isActive: row.is_active ?? true,
});

const mapBudgetGoalRow = (row: BudgetGoalRow): BudgetGoal => ({
  id: row.id,
  name: row.name,
  target: row.target,
  period: row.period,
  category: row.category ?? null,
});

const mapCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  type: row.type,
});

const ensureClient = () => {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  return client;
};

export const fetchFinanceSnapshot = async (): Promise<FinanceSnapshotPayload | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const client = ensureClient();
  if (!client) {
    return null;
  }

  const [transactions, accounts, profile, recurringTransactions, budgetGoals, categories] = await Promise.all([
    client.from("transactions").select("*"),
    client.from("accounts").select("*"),
    client.from("profiles").select("*").limit(1),
    client.from("recurring_transactions").select("*"),
    client.from("budget_goals").select("*"),
    client.from("categories").select("*"),
  ]);

  const snapshot: FinanceSnapshotPayload = {};

  if (!transactions.error && transactions.data) {
    snapshot.transactions = transactions.data.map(mapTransactionRow);
  }

  if (!accounts.error && accounts.data) {
    snapshot.accounts = accounts.data.map(mapAccountRow);
  }

  if (!recurringTransactions.error && recurringTransactions.data) {
    snapshot.recurringTransactions = recurringTransactions.data.map(mapRecurringRow);
  }

  if (!budgetGoals.error && budgetGoals.data) {
    snapshot.budgetGoals = budgetGoals.data.map(mapBudgetGoalRow);
  }

  if (!categories.error && categories.data) {
    snapshot.preferences = {
      ...snapshot.preferences,
      categories: categories.data.map(mapCategoryRow),
    };
  }

  if (!profile.error && profile.data?.[0]) {
    const details = profile.data[0] as ProfileRow;
    snapshot.profile = {
      name: details.name ?? undefined,
      currency: details.currency ?? undefined,
    };
    if (details.theme_mode) {
      snapshot.preferences = {
        ...snapshot.preferences,
        themeMode: details.theme_mode,
      };
    }
  }

  return snapshot;
};

const toTransactionRow = (transaction: Transaction): TransactionRow => ({
  id: transaction.id,
  amount: transaction.amount,
  note: transaction.note,
  type: transaction.type,
  category: transaction.category,
  date: transaction.date,
  account_id: transaction.accountId,
  to_account_id: transaction.toAccountId ?? null,
  participants: transaction.participants ?? null,
  location: transaction.location ?? null,
  photos: transaction.photos ?? null,
  exclude_from_reports: transaction.excludeFromReports ?? false,
});

const toAccountRow = (account: Account): AccountRow => ({
  id: account.id,
  name: account.name,
  type: account.type,
  currency: account.currency,
  initial_balance: account.initialBalance,
  exclude_from_total: account.excludeFromTotal ?? false,
  is_archived: account.isArchived ?? false,
  created_at: account.createdAt,
});

const toRecurringRow = (
  recurring: RecurringTransaction,
): RecurringTransactionRow => ({
  id: recurring.id,
  amount: recurring.amount,
  note: recurring.note,
  type: recurring.type,
  category: recurring.category,
  account_id: recurring.accountId,
  to_account_id: recurring.toAccountId ?? null,
  frequency: recurring.frequency,
  next_occurrence: recurring.nextOccurrence,
  is_active: recurring.isActive ?? true,
});

const toBudgetGoalRow = (goal: BudgetGoal): BudgetGoalRow => ({
  id: goal.id,
  name: goal.name,
  target: goal.target,
  period: goal.period,
  category: goal.category ?? null,
});

const toCategoryRow = (category: Category): CategoryRow => ({
  id: category.id,
  name: category.name,
  type: category.type,
});

export const upsertTransaction = async (transaction: Transaction) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("transactions").upsert([toTransactionRow(transaction)]);
  if (error) {
    console.warn("Failed to upsert transaction to Supabase", error.message);
  }
};

export const deleteTransaction = async (id: string) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) {
    console.warn("Failed to delete transaction from Supabase", error.message);
  }
};

export const upsertAccount = async (account: Account) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("accounts").upsert([toAccountRow(account)]);
  if (error) {
    console.warn("Failed to upsert account to Supabase", error.message);
  }
};

export const deleteAccount = async (id: string) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("accounts").delete().eq("id", id);
  if (error) {
    console.warn("Failed to delete account from Supabase", error.message);
  }
};

export const upsertRecurringTransaction = async (
  recurring: RecurringTransaction,
) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client
    .from("recurring_transactions")
    .upsert([toRecurringRow(recurring)]);
  if (error) {
    console.warn("Failed to upsert recurring transaction to Supabase", error.message);
  }
};

export const deleteRecurringTransaction = async (id: string) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("recurring_transactions").delete().eq("id", id);
  if (error) {
    console.warn("Failed to delete recurring transaction from Supabase", error.message);
  }
};

export const upsertBudgetGoal = async (goal: BudgetGoal) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("budget_goals").upsert([toBudgetGoalRow(goal)]);
  if (error) {
    console.warn("Failed to upsert budget goal to Supabase", error.message);
  }
};

export const deleteBudgetGoal = async (id: string) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("budget_goals").delete().eq("id", id);
  if (error) {
    console.warn("Failed to delete budget goal from Supabase", error.message);
  }
};

export const upsertCategories = async (categories: Category[]) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const { error } = await client.from("categories").upsert(categories.map(toCategoryRow));
  if (error) {
    console.warn("Failed to sync categories to Supabase", error.message);
  }
};

export const upsertProfile = async (
  profile: FinanceSnapshotPayload["profile"],
  preferences: FinanceSnapshotPayload["preferences"],
) => {
  const client = ensureClient();
  if (!client) {
    return;
  }

  const payload: ProfileRow = {
    id: "primary",
    name: profile?.name ?? undefined,
    currency: profile?.currency ?? undefined,
    theme_mode: preferences?.themeMode ?? undefined,
  };

  const { error } = await client.from("profiles").upsert([payload]);
  if (error) {
    console.warn("Failed to update profile in Supabase", error.message);
  }
};
