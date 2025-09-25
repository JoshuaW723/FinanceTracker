import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";

import { colors, components, spacing, typography } from "../../theme";
import { TransactionType, useFinanceStore } from "../../lib/store";

const categories = [
  "Food",
  "Travel",
  "Lifestyle",
  "Work",
  "Salary",
  "Investing",
];

export default function NewTransactionModal() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const currency = useFinanceStore((state) => state.profile.currency);

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");

  const handleSubmit = () => {
    const parsedAmount = Number(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Hold up", "Enter a positive amount to continue.");
      return;
    }

    addTransaction({
      amount: parsedAmount,
      note: note.trim() || (type === "expense" ? "Expense" : "Income"),
      category,
      type,
      date: date.toISOString(),
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={32}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Add transaction</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toggleRow}>
            {["expense", "income"].map((value) => {
              const isActive = type === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setType(value as TransactionType)}
                  style={[styles.toggleChip, isActive && styles.toggleChipActive]}
                >
                  <Text
                    style={[styles.toggleText, isActive && styles.toggleTextActive]}
                  >
                    {value === "expense" ? "Expense" : "Income"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount ({currency})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              style={[components.input, styles.input]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a short note"
              placeholderTextColor={colors.textMuted}
              style={[components.input, styles.input]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryRow}>
                {categories.map((item) => {
                  const isActive = category === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    >
                      <Text
                        style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              style={[components.input, styles.input, styles.dateButton]}
              onPress={() => setShowPicker((prev) => !prev)}
            >
              <Text style={styles.dateText}>{dayjs(date).format("MMM D, YYYY")}</Text>
              <Ionicons name="calendar" size={20} color={colors.textMuted} />
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                  if (Platform.OS !== "ios") {
                    setShowPicker(false);
                  }
                }}
              />
            )}
          </View>
        </ScrollView>

        <Pressable
          style={[components.buttonPrimary, styles.submitButton]}
          onPress={handleSubmit}
        >
          <Text style={components.buttonPrimaryText}>Add transaction</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.body,
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toggleChip: {
    ...components.chip,
  },
  toggleChipActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: colors.text,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.subtitle,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  input: {
    fontSize: 16,
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  categoryChip: {
    ...components.chip,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: colors.text,
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    margin: spacing.xl,
  },
});
