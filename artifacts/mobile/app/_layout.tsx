import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
} from "@expo-google-fonts/tajawal";
import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nManager } from "react-native";
import { isRTL } from "@/lib/i18n";

// We disable native I18nManager RTL and handle layout manually via layoutDirection.ts
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch (e) {
  console.warn("RTL initialization failed:", e);
}

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { DeveloperModeProvider } from "@/context/DeveloperModeContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

try {
  initializeRevenueCat();
} catch (err: any) {
  // RevenueCat init failure is non-fatal — app continues without subscriptions
  console.warn("RevenueCat init failed:", err?.message);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="result" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SubscriptionProvider>
            <AnalysisProvider>
              <DeveloperModeProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <SafeAreaProvider>
                    <RootLayoutNav />
                  </SafeAreaProvider>
                </GestureHandlerRootView>
              </DeveloperModeProvider>
            </AnalysisProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
