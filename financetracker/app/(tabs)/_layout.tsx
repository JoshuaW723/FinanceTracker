import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

function AddTransactionTabButton({ style, ...props }: BottomTabBarButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      {...props}
      onPress={(event) => {
        event.preventDefault();
        router.push("/transactions/new");
      }}
      style={({ pressed }) => [style, styles.addButtonWrapper, pressed && styles.addButtonWrapperPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
    >
      <View style={styles.addButtonIconWrapper}>
        <Ionicons name="add" size={22} color={colors.background} />
      </View>
      <Text style={styles.addButtonLabel}>Add</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.select({ ios: 72, default: 60 }),
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: Platform.select({ ios: 16, default: 10 }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-transaction"
        options={{
          title: "Add",
          href: undefined,
          tabBarButton: (props) => <AddTransactionTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "podium" : "podium-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addButtonWrapperPressed: {
    opacity: 0.8,
  },
  addButtonIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.success,
    shadowOpacity: Platform.OS === "ios" ? 0.35 : 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  addButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
});
