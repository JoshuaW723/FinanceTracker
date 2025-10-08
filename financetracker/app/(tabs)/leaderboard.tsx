import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";

const mockLeaders = [
  { id: "1", name: "Alicia Jeanelly", progress: "Spark Balance +18%" },
  { id: "2", name: "Joshua Wibowo", progress: "Saved $420 this month" },
  { id: "3", name: "Timothy Gratio", progress: "Debt free streak: 6 weeks" },
];

export default function LeaderboardScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>
          Celebrate wins with your crew. Challenge incoming soon.
        </Text>
      </View>
      <FlatList
        data={mockLeaders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.lg }} />}
        renderItem={({ item, index }) => (
          <View style={[theme.components.surface, styles.card]}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>{item.name}</Text>
              <Text style={styles.leaderMeta}>{item.progress}</Text>
            </View>
            <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
          </View>
        )}
      />
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
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
    },
    header: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    title: {
      ...theme.typography.title,
    },
    subtitle: {
      ...theme.typography.subtitle,
    },
    listContent: {
      paddingBottom: theme.spacing.xxl * 1.5 + insets.bottom,
      gap: theme.spacing.lg,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    rankBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    rankText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    leaderInfo: {
      gap: 4,
      flex: 1,
    },
    leaderName: {
      ...theme.typography.body,
      fontSize: 18,
      fontWeight: "600",
    },
    leaderMeta: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
  });
