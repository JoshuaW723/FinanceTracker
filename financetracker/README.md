# FinanceTracker Expo App

A minimalist finance tracker MVP built with Expo Router, TypeScript, Zustand, and a dark neon aesthetic. Designed for seamless use inside Expo Go on iOS with a modular structure so data storage can evolve toward SQLite in the future.

## Features

- **Bottom tab navigation** with Home, Transactions, Leaderboard, and Account screens powered by Expo Router.
- **Home dashboard** showing balance, monthly insights, and a 7-day cash flow mini bar chart rendered with `react-native-svg`.
- **Floating action button** to add new transactions in a polished modal using the native date picker.
- **Transactions feed** grouped by day with income in green and expenses in red.
- **Account settings** to tweak the profile name and preferred currency, ready for future persistence layers.
- **Global state** handled via Zustand with mock data so the UI is populated on first launch.

## Project structure

```
app/
  _layout.tsx            // Root stack & modal wiring
  (tabs)/                // Bottom tab routes
    _layout.tsx
    home.tsx
    transactions.tsx
    leaderboard.tsx
    account.tsx
  transactions/
    new.tsx              // Add transaction modal
components/
  MiniBarChart.tsx
lib/
  store.ts               // Zustand store + seed data
theme.ts                 // Shared colors, spacing, typography, components
```

## Getting started on Windows

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the Expo dev server**
   ```bash
   npx expo start --tunnel
   ```
   The `--tunnel` flag is recommended on Windows to avoid local network configuration issues when pairing with an iOS device running Expo Go.

3. **Open the app**
   - Scan the QR code with the Camera app on your iPhone and open with Expo Go, **or**
   - Run `npx expo start --ios` from a Mac if you have access to the iOS simulator.

## Key dependencies

- `expo-router` for typed, file-based navigation
- `zustand` for simple global state management
- `@react-native-community/datetimepicker` for native date selection
- `react-native-svg` for the dashboard mini chart
- `dayjs` for lightweight date formatting

All dependencies ship with Expo SDK 54 defaults, so no native configuration is required.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Launch the Expo dev server |
| `npm run ios` | Shortcut for `expo start --ios` |
| `npm run android` | Shortcut for `expo start --android` |
| `npm run web` | Launch the web preview |
| `npm run lint` | Run Expo's ESLint preset |

## Next steps

- Replace the in-memory store with SQLite or another persistent layer.
- Sync transactions with a backend for multi-device support.
- Expand the leaderboard into a social feature with live rankings.

Enjoy tracking your spending! ✨
