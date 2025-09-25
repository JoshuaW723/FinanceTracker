import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, components, spacing, typography } from "../../theme";
import { useFinanceStore } from "../../lib/store";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

export default function AccountScreen() {
  const profile = useFinanceStore((state) => state.profile);
  const updateProfile = useFinanceStore((state) => state.updateProfile);

  const [name, setName] = useState(profile.name);
  const [currency, setCurrency] = useState(profile.currency);

  useEffect(() => {
    setName(profile.name);
    setCurrency(profile.currency);
  }, [profile.name, profile.currency]);

  const handleSave = () => {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.subtitle}>Personalize how your finance world looks.</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Profile name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your display name"
              placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                      <Text
                        style={[styles.currencyChipText, isActive && styles.currencyChipTextActive]}
                      >
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Pressable style={components.buttonPrimary} onPress={handleSave}>
            <Text style={components.buttonPrimaryText}>Save changes</Text>
          </Pressable>
        </View>
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
  content: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
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
    ...components.input,
    fontSize: 16,
  },
  currencyRow: {
    gap: spacing.md,
  },
  currencyInput: {
    letterSpacing: 3,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  currencyChip: {
    ...components.chip,
  },
  currencyChipActive: {
    backgroundColor: colors.primary,
  },
  currencyChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  currencyChipTextActive: {
    color: colors.text,
  },
});
