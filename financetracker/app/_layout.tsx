import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAppTheme } from "../theme";
import { useFinanceStore } from "../lib/store";

export default function RootLayout() {
  const theme = useAppTheme();
  const themeMode = useFinanceStore((state) => state.preferences.themeMode);
  const statusBarStyle = themeMode === "light" ? "dark" : "light";

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="transactions/new"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="transactions/net-income-details"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/category-details"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/net-income-week"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="transactions/report"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </>
  );
}
