import { Stack } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"

// Reanimated's Babel plugin is auto-configured by babel-preset-expo (SDK 57) —
// no babel.config.js needed. GestureHandlerRootView must wrap the whole app for
// the Skia canvas gestures we add in Phase 4.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
