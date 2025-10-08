import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../../theme";
import {
  Category,
  DEFAULT_CATEGORIES,
  RecurringTransaction,
  Transaction,
  TransactionType,
  useFinanceStore,
} from "../../lib/store";

interface TransactionFormProps {
  title: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (transaction: Omit<Transaction, "id">) => void;
  initialValues?: Partial<Transaction>;
  enableRecurringOption?: boolean;
  onSubmitRecurring?: (
    transaction: Omit<Transaction, "id">,
    config: { frequency: RecurringTransaction["frequency"]; startDate: string },
  ) => void;
}

const MAX_PHOTOS = 3;

type LocaleSeparators = {
  decimal: string;
  group: string;
};

const getLocaleSeparators = (): LocaleSeparators => {
  const parts = new Intl.NumberFormat(undefined).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  return { decimal, group };
};

const formatNumberForInput = (
  value: number,
  separators: LocaleSeparators,
  groupingFormatter: Intl.NumberFormat,
): string => {
  if (Number.isNaN(value)) {
    return "";
  }

  const fixed = value.toString();
  const [integerPart, decimalPart] = fixed.split(".");
  const groupedInteger = groupingFormatter.format(Number(integerPart));

  if (decimalPart && decimalPart.length > 0) {
    return `${groupedInteger}${separators.decimal}${decimalPart}`;
  }

  return groupedInteger;
};

const formatRawAmountInput = (
  rawValue: string,
  separators: LocaleSeparators,
  groupingFormatter: Intl.NumberFormat,
): string => {
  const trimmed = rawValue.replace(/[\s']/g, "");
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed.replace(/[^0-9.,]/g, "");
  if (!sanitized) {
    return "";
  }

  const endsWithSeparator = /[.,]$/.test(sanitized);
  const lastSeparatorIndex = Math.max(sanitized.lastIndexOf("."), sanitized.lastIndexOf(","));
  let integerPartRaw = sanitized;
  let decimalPartRaw = "";

  if (lastSeparatorIndex !== -1) {
    integerPartRaw = sanitized.slice(0, lastSeparatorIndex);
    decimalPartRaw = sanitized.slice(lastSeparatorIndex + 1).replace(/[^0-9]/g, "");
  }

  const integerDigits = integerPartRaw.replace(/[^0-9]/g, "");

  if (!integerDigits) {
    if (decimalPartRaw) {
      return `0${separators.decimal}${decimalPartRaw}`;
    }
    return endsWithSeparator ? `0${separators.decimal}` : "";
  }

  const groupedInteger = groupingFormatter.format(Number(integerDigits));

  if (decimalPartRaw) {
    return `${groupedInteger}${separators.decimal}${decimalPartRaw}`;
  }

  if (endsWithSeparator) {
    return `${groupedInteger}${separators.decimal}`;
  }

  return groupedInteger;
};

const parseAmountInput = (rawValue: string): number => {
  const sanitized = rawValue
    .replace(/[\s']/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!sanitized) {
    return Number.NaN;
  }

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");
  let normalized = sanitized;

  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(",");
    const lastDot = sanitized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    const thousandPattern = new RegExp(`\\${thousandSeparator}`, "g");
    normalized = normalized.replace(thousandPattern, "");
    if (decimalSeparator === ",") {
      normalized = normalized.replace(/,/g, ".");
    }
  } else if (hasComma) {
    const parts = sanitized.split(",");
    const isDecimalCandidate =
      (parts.length === 2 && parts[1].length <= 2) ||
      (parts.length === 2 && parts[1].length <= 3 && parts[0].length > 2);

    normalized = isDecimalCandidate ? sanitized.replace(/,/g, ".") : sanitized.replace(/,/g, "");
  } else if (hasDot) {
    const parts = sanitized.split(".");
    const isDecimalCandidate = parts.length === 2 && parts[1].length <= 3;
    normalized = isDecimalCandidate ? sanitized : sanitized.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) {
    return Number.NaN;
  }

  const decimalPart = normalized.split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return Math.round(value * 100) / 100;
  }

  return value;
};

const recurringOptions: { label: string; value: RecurringTransaction["frequency"] }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];

export function TransactionForm({
  title,
  submitLabel,
  onCancel,
  onSubmit,
  initialValues,
  enableRecurringOption = false,
  onSubmitRecurring,
}: TransactionFormProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const availableCategories = categories.length ? categories : DEFAULT_CATEGORIES;

  const findInitialCategory = () => {
    if (!initialValues?.category) {
      return null;
    }

    return (
      availableCategories.find(
        (category) =>
          category.name === initialValues.category &&
          (!initialValues.type || category.type === initialValues.type),
      ) ?? null
    );
  };

  const separators = useMemo(() => getLocaleSeparators(), []);
  const groupingFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { useGrouping: true, maximumFractionDigits: 0 }),
    [],
  );

  const [amount, setAmount] = useState(() =>
    initialValues?.amount !== undefined
      ? formatNumberForInput(initialValues.amount, separators, groupingFormatter)
      : "",
  );
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(findInitialCategory);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [date, setDate] = useState(() => {
    const base = initialValues?.date ? new Date(initialValues.date) : new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === "ios");
  const [detailsExpanded, setDetailsExpanded] = useState(() =>
    Boolean(
      initialValues?.participants?.length ||
        initialValues?.location ||
        initialValues?.photos?.length ||
        initialValues?.excludeFromReports,
    ),
  );
  const [participants, setParticipants] = useState<string[]>(initialValues?.participants ?? []);
  const [participantDraft, setParticipantDraft] = useState("");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [photos, setPhotos] = useState<string[]>(initialValues?.photos ?? []);
  const [excludeFromReports, setExcludeFromReports] = useState(
    Boolean(initialValues?.excludeFromReports),
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    RecurringTransaction["frequency"]
  >("monthly");

  useEffect(() => {
    if (initialValues?.amount !== undefined) {
      setAmount(formatNumberForInput(initialValues.amount, separators, groupingFormatter));
    } else {
      setAmount("");
    }
  }, [groupingFormatter, initialValues?.amount, separators]);

  useEffect(() => {
    if (!enableRecurringOption) {
      setIsRecurring(false);
    }
  }, [enableRecurringOption]);

  const noteWordCount = useMemo(() => {
    if (!note.trim()) return 0;
    return note
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [note]);

  const handleNoteChange = (value: string) => {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!value.trim()) {
      setNote(value);
      return;
    }

    if (words.length <= 100) {
      setNote(value);
      return;
    }

    const limited = words.slice(0, 100).join(" ");
    setNote(limited);
  };

  const handleAddParticipant = () => {
    const value = participantDraft.trim();
    if (!value) {
      return;
    }

    setParticipants((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setParticipantDraft("");
  };

  const handleRemoveParticipant = (person: string) => {
    setParticipants((prev) => prev.filter((item) => item !== person));
  };

  const handlePickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Photo limit reached",
        `You can attach up to ${MAX_PHOTOS} photos per transaction.`,
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "We need gallery access to add a receipt photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          setPhotos((prev) => [...prev, asset.uri]);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Something went wrong", "We couldn't open the photo library just now.");
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(formatRawAmountInput(value, separators, groupingFormatter));
    },
    [groupingFormatter, separators],
  );

  const handleSubmit = () => {
    const parsedAmount = parseAmountInput(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Hold up", "Enter a positive amount to continue.");
      return;
    }

    if (!selectedCategory) {
      Alert.alert("Choose a category", "Pick a category to classify this transaction.");
      return;
    }

    const trimmedNote = note.trim();
    const cleanedParticipants = participants.map((person) => person.trim()).filter(Boolean);
    const cleanedPhotos = photos.filter(Boolean);

    const payload: Omit<Transaction, "id"> = {
      amount: parsedAmount,
      note: trimmedNote || (selectedCategory.type === "expense" ? "Expense" : "Income"),
      category: selectedCategory.name,
      type: selectedCategory.type,
      date: date.toISOString(),
      participants: cleanedParticipants,
      location: location.trim() || undefined,
      photos: cleanedPhotos,
      excludeFromReports,
    };

    onSubmit(payload);

    if (enableRecurringOption && isRecurring && onSubmitRecurring) {
      onSubmitRecurring(payload, {
        frequency: recurringFrequency,
        startDate: date.toISOString(),
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={32 + insets.top}
      >
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.closeButton} accessibilityRole="button">
            <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount ({currency})</Text>
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <Pressable
              style={[styles.input, styles.categoryButton]}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text
                style={selectedCategory ? styles.categoryButtonText : styles.categoryButtonPlaceholder}
              >
                {selectedCategory ? selectedCategory.name : "Choose a category"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
            </Pressable>
            {selectedCategory ? (
              <View style={styles.typeBadge(selectedCategory.type)}>
                <Ionicons
                  name={selectedCategory.type === "income" ? "arrow-down-circle" : "arrow-up-circle"}
                  size={14}
                  color={theme.colors.text}
                />
                <Text style={styles.typeBadgeText}>
                  {selectedCategory.type === "expense" ? "Expense" : "Income"}
                </Text>
              </View>
            ) : (
              <Text style={styles.helperText}>Selecting a category sets whether this is income or expense.</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={handleNoteChange}
              placeholder="Add a short note"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={[styles.input, styles.noteInput]}
            />
            <View style={styles.helperRow}>
              <Text style={styles.helperText}>Up to 100 words</Text>
              <Text style={styles.helperText}>{noteWordCount}/100</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              style={[styles.input, styles.dateButton]}
              onPress={() => setShowDatePicker((prev) => (Platform.OS === "ios" ? prev : !prev))}
            >
              <Text style={styles.dateText}>{dayjs(date).format("MMM D, YYYY")}</Text>
              <Ionicons name="calendar" size={20} color={theme.colors.textMuted} />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    const next = new Date(selectedDate);
                    next.setHours(0, 0, 0, 0);
                    setDate(next);
                  }
                  if (Platform.OS !== "ios") {
                    setShowDatePicker(false);
                  }
                }}
              />
            )}
          </View>

          {enableRecurringOption && (
            <View style={styles.recurringCard}>
              <View style={styles.recurringHeader}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Make recurring</Text>
                  <Text style={styles.helperText}>
                    Repeat this transaction automatically on a schedule.
                  </Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  thumbColor={isRecurring ? theme.colors.primary : theme.colors.surface}
                  trackColor={{ true: `${theme.colors.primary}55`, false: theme.colors.border }}
                />
              </View>

              {isRecurring && (
                <View style={styles.recurringBody}>
                  <Text style={styles.label}>Repeats</Text>
                  <View style={styles.frequencyRow}>
                    {recurringOptions.map((option) => {
                      const active = recurringFrequency === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={styles.frequencyPill(active)}
                          onPress={() => setRecurringFrequency(option.value)}
                        >
                          <Text style={styles.frequencyPillText(active)}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.helperText}>
                    Next occurrence will be on {dayjs(date).format("MMM D, YYYY")}.
                  </Text>
                </View>
              )}
            </View>
          )}

          <Pressable
            style={styles.detailsToggle}
            onPress={() => setDetailsExpanded((prev) => !prev)}
          >
            <View>
              <Text style={styles.detailsToggleTitle}>Add more details</Text>
              <Text style={styles.detailsToggleSubtitle}>
                With, location, photos and reporting preferences
              </Text>
            </View>
            <Ionicons
              name={detailsExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.text}
            />
          </Pressable>

          {detailsExpanded && (
            <View style={styles.detailsCard}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>With (optional)</Text>
                <View style={styles.participantRow}>
                  <TextInput
                    value={participantDraft}
                    onChangeText={setParticipantDraft}
                    placeholder="Add a person"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.flex]}
                    returnKeyType="done"
                    onSubmitEditing={handleAddParticipant}
                  />
                  <Pressable style={styles.secondaryButton} onPress={handleAddParticipant}>
                    <Text style={styles.secondaryButtonText}>Add</Text>
                  </Pressable>
                </View>
                {participants.length > 0 && (
                  <View style={styles.participantChips}>
                    {participants.map((person) => (
                      <View key={person} style={styles.participantChip}>
                        <Text style={styles.participantChipText}>{person}</Text>
                        <Pressable
                          onPress={() => handleRemoveParticipant(person)}
                          style={styles.removeChip}
                        >
                          <Ionicons name="close" size={12} color={theme.colors.text} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Location (optional)</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Add where this happened"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Photos (optional)</Text>
                <View style={styles.photoRow}>
                  {photos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.photoPreview}>
                      <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
                      <Pressable
                        onPress={() => handleRemovePhoto(index)}
                        style={styles.removePhotoButton}
                      >
                        <Ionicons name="close" size={14} color={theme.colors.text} />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <Pressable style={styles.photoAddButton} onPress={handlePickPhoto}>
                      <Ionicons name="image" size={22} color={theme.colors.textMuted} />
                      <Text style={styles.photoAddText}>Upload</Text>
                      <Text style={styles.photoLimit}>{`${photos.length}/${MAX_PHOTOS}`}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.excludeRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Exclude from reports</Text>
                  <Text style={styles.helperText}>
                    Keep this transaction visible in the log but out of summaries.
                  </Text>
                </View>
                <Switch
                  value={excludeFromReports}
                  onValueChange={setExcludeFromReports}
                  thumbColor={excludeFromReports ? theme.colors.primary : theme.colors.surface}
                  trackColor={{ true: `${theme.colors.primary}55`, false: theme.colors.border }}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        </Pressable>
      </KeyboardAvoidingView>

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select category</Text>
            <Pressable
              onPress={() => setCategoryModalVisible(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {(["expense", "income"] as TransactionType[]).map((type) => {
              const entries = availableCategories.filter((category) => category.type === type);
              if (!entries.length) {
                return (
                  <View key={type} style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      {type === "expense" ? "Expenses" : "Income"}
                    </Text>
                    <Text style={styles.helperText}>No categories available yet.</Text>
                  </View>
                );
              }

              return (
                <View key={type} style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    {type === "expense" ? "Expenses" : "Income"}
                  </Text>
                  <View style={styles.modalGrid}>
                    {entries.map((category) => {
                      const active = selectedCategory?.id === category.id;
                      return (
                        <Pressable
                          key={category.id}
                          style={styles.modalOption(active)}
                          onPress={() => {
                            setSelectedCategory(category);
                            setCategoryModalVisible(false);
                          }}
                        >
                          <Text style={styles.modalOptionText(active)}>{category.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
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
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    headerSpacer: {
      width: 32,
    },
    title: {
      ...theme.typography.title,
      fontSize: 22,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.lg,
    },
    fieldGroup: {
      gap: theme.spacing.sm,
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
    categoryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    categoryButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
    categoryButtonPlaceholder: {
      color: theme.colors.textMuted,
      fontWeight: "500",
    },
    typeBadge: (type: TransactionType) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor:
        type === "income" ? `${theme.colors.success}22` : `${theme.colors.danger}22`,
    }),
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    helperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    noteInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    recurringCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    recurringHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    recurringBody: {
      gap: theme.spacing.sm,
    },
    frequencyRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    frequencyPill: (active: boolean) => ({
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? `${theme.colors.primary}22` : theme.colors.surface,
    }),
    frequencyPillText: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: active ? theme.colors.text : theme.colors.textMuted,
    }),
    detailsToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
    },
    detailsToggleTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    detailsToggleSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    detailsCard: {
      ...theme.components.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    participantRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      ...theme.components.buttonSecondary,
      paddingHorizontal: theme.spacing.lg,
    },
    secondaryButtonText: {
      ...theme.components.buttonSecondaryText,
    },
    participantChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    participantChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    participantChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    removeChip: {
      marginLeft: theme.spacing.xs,
    },
    photoRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    photoPreview: {
      width: 82,
      height: 82,
      borderRadius: theme.radii.md,
      overflow: "hidden",
      position: "relative",
    },
    photoImage: {
      width: "100%",
      height: "100%",
      borderRadius: theme.radii.md,
    },
    removePhotoButton: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    photoAddButton: {
      width: 82,
      height: 82,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    photoAddText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "600",
    },
    photoLimit: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    excludeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    submitButton: {
      ...theme.components.buttonPrimary,
      marginTop: theme.spacing.lg,
      marginHorizontal: theme.spacing.xl,
      marginBottom: theme.spacing.xl + insets.bottom,
    },
    submitButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 18,
    },
    modalClose: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    modalContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    modalSection: {
      gap: theme.spacing.sm,
    },
    modalSectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    modalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    modalOption: (active: boolean) => ({
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? `${theme.colors.primary}22` : theme.colors.surface,
    }),
    modalOptionText: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600",
      color: active ? theme.colors.text : theme.colors.textMuted,
    }),
  });
