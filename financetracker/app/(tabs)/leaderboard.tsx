import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { colors, components, spacing, typography } from "../../theme";

const mockLeaders = [
  { id: "1", name: "Avery Rivera", progress: "Spark Balance +18%" },
  { id: "2", name: "Noah Kim", progress: "Saved $420 this month" },
  { id: "3", name: "Zoe Patel", progress: "Debt free streak: 6 weeks" },
];

export default function LeaderboardScreen() {
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
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        renderItem={({ item, index }) => (
          <View style={[components.surface, styles.card]}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>{item.name}</Text>
              <Text style={styles.leaderMeta}>{item.progress}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
  },
  listContent: {
    paddingBottom: spacing.xxl * 1.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  rankBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  leaderInfo: {
    gap: 4,
    flex: 1,
  },
  leaderName: {
    ...typography.body,
    fontSize: 18,
    fontWeight: "600",
  },
  leaderMeta: {
    ...typography.subtitle,
    fontSize: 14,
  },
});
