import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

function getRevenueCatApiKey(): string {
  // 1. Production / Internal Testing Android Mode -> Priority: Google Play Key
  if (Platform.OS === "android" && REVENUECAT_ANDROID_API_KEY) {
    console.log("[RevenueCat SDK] Platform: Android. Configured Key: EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (Google Play Store)");
    return REVENUECAT_ANDROID_API_KEY;
  }

  // 2. iOS Mode
  if (Platform.OS === "ios" && REVENUECAT_IOS_API_KEY) {
    console.log("[RevenueCat SDK] Platform: iOS. Configured Key: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
    return REVENUECAT_IOS_API_KEY;
  }

  // 3. Web or Fallback Mode -> Test Store Key
  if (REVENUECAT_TEST_API_KEY) {
    console.log("[RevenueCat SDK] Configured Key: EXPO_PUBLIC_REVENUECAT_TEST_API_KEY (RevenueCat Test Store)");
    return REVENUECAT_TEST_API_KEY;
  }

  const fallback = REVENUECAT_ANDROID_API_KEY || REVENUECAT_IOS_API_KEY || "";
  if (!fallback) {
    console.warn("[RevenueCat SDK] Warning: No RevenueCat Public API Keys configured!");
  }
  return fallback;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;

  Purchases.setLogLevel(
    __DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.ERROR
  );
  try {
    Purchases.configure({ apiKey });
    console.log("[RevenueCat SDK] Successfully configured RevenueCat SDK.");
  } catch (err: any) {
    console.warn("[RevenueCat SDK] RevenueCat configure failed:", err?.message);
  }
}

/**
 * Call after login/register to tie RevenueCat purchases to the user's DB id.
 * Without this, purchases are anonymous and the server can't verify entitlements.
 */
export async function loginRevenueCat(userId: string): Promise<CustomerInfo | null> {
  try {
    const currentId = await Purchases.getAppUserID();
    console.log(`[RevenueCat SDK] Binding User ID. Current RC AppUserID: '${currentId}' -> Tayyibati User ID: '${userId}'`);
    const result = await Purchases.logIn(userId);
    console.log(`[RevenueCat SDK] Logged into RevenueCat successfully. Customer originalAppUserId: '${result.customerInfo.originalAppUserId}'`);
    return result.customerInfo;
  } catch (err: any) {
    console.warn("[RevenueCat SDK] RevenueCat logIn failed:", err?.message);
    return null;
  }
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();

      return offerings;
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // Only show loading if BOTH queries are still pending (not just slow/errored)
  const isLoading =
    (customerInfoQuery.isPending && !customerInfoQuery.isError) ||
    (offeringsQuery.isPending && !offeringsQuery.isError);

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError: purchaseMutation.error,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
