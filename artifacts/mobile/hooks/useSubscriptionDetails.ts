import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/lib/revenuecat";
import { getSubscriptionDetails, SubscriptionDetailsResponse } from "@/lib/api";
import { formatArabicDate, formatRemainingDays, getRemainingDaysCount } from "@/lib/dateUtils";

export type SubscriptionUIStatus =
  | "ACTIVE"
  | "CANCELLED" // Auto-renew off
  | "EXPIRED"
  | "BILLING_ISSUE"
  | "FREE"
  | "ERROR";

export interface UnifiedSubscriptionDetails {
  status: SubscriptionUIStatus;
  planName: string;
  startDate: string | null;
  expirationDate: string | null;
  formattedStartDate: string;
  formattedExpirationDate: string;
  remainingDays: number | null;
  formattedRemainingDays: string;
  autoRenew: boolean;
  billingIssue: boolean;
  store: string | null;
  managementURL: string;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useSubscriptionDetails(): UnifiedSubscriptionDetails {
  const { user } = useAuth();
  const { customerInfo, isSubscribed, hasBillingIssue } = useSubscription();

  const subscriptionQuery = useQuery<SubscriptionDetailsResponse>({
    queryKey: ["user", "subscription", user?.id],
    queryFn: getSubscriptionDetails,
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    // 1. Authoritative check: User is premium if their account is marked premium in backend,
    // or if backend /me/subscription reports an active status,
    // or if local RevenueCat has an active entitlement explicitly tied to this user's ID.
    const isRcUserMatch = Boolean(user?.id && customerInfo?.originalAppUserId === user.id);
    const hasValidNativeEntitlement = isSubscribed && isRcUserMatch;
    const isBackendPremium = Boolean(user?.isPremium || (subscriptionQuery.data && subscriptionQuery.data.status !== "FREE"));
    const isUserPremium = isBackendPremium || hasValidNativeEntitlement;

    if (!isUserPremium) {
      return {
        status: "FREE",
        planName: "مجاني",
        startDate: null,
        expirationDate: null,
        formattedStartDate: "",
        formattedExpirationDate: "",
        remainingDays: null,
        formattedRemainingDays: "",
        autoRenew: false,
        billingIssue: false,
        store: null,
        managementURL: "https://play.google.com/store/account/subscriptions",
        isLoading: false,
        isError: false,
        refetch: subscriptionQuery.refetch,
      };
    }

    // 2. Extract entitlement info from native RevenueCat CustomerInfo (scoped to current user)
    const activeEnt = isRcUserMatch
      ? (customerInfo?.entitlements?.active?.["premium"] || customerInfo?.entitlements?.all?.["premium"])
      : null;

    // 3. Extract dates & flags, prioritizing RevenueCat device receipt then server DB/sync
    const backendData = subscriptionQuery.data;

    const startDate =
      activeEnt?.originalPurchaseDate ||
      activeEnt?.latestPurchaseDate ||
      backendData?.startDate ||
      null;

    const expirationDate =
      activeEnt?.expirationDate ||
      backendData?.expirationDate ||
      null;

    const isBillingProblem =
      hasBillingIssue ||
      !!activeEnt?.billingIssueDetectedAt ||
      !!backendData?.billingIssue;

    // Check auto-renew: true only if willRenew is explicitly true or not cancelled
    let autoRenew = true;
    if (activeEnt) {
      autoRenew = activeEnt.willRenew !== false && !activeEnt.unsubscribeDetectedAt;
    } else if (backendData) {
      autoRenew = backendData.autoRenew;
    }

    const remainingDays = getRemainingDaysCount(expirationDate);
    const isExpired = remainingDays !== null && remainingDays < 0;

    let status: SubscriptionUIStatus = "ACTIVE";
    if (isBillingProblem) {
      status = "BILLING_ISSUE";
    } else if (isExpired) {
      status = "EXPIRED";
    } else if (!autoRenew) {
      status = "CANCELLED"; // Auto-renew turned off
    } else {
      status = "ACTIVE";
    }

    const planName =
      backendData?.planName ||
      (activeEnt?.productIdentifier ? "Tayyibati Premium" : "Tayyibati Premium");

    const store =
      activeEnt?.store ||
      backendData?.store ||
      "PLAY_STORE";

    const managementURL =
      customerInfo?.managementURL ||
      "https://play.google.com/store/account/subscriptions";

    const hasError =
      subscriptionQuery.isError && !activeEnt && !backendData;

    return {
      status: hasError ? "ERROR" : status,
      planName,
      startDate,
      expirationDate,
      formattedStartDate: formatArabicDate(startDate),
      formattedExpirationDate: formatArabicDate(expirationDate),
      remainingDays,
      formattedRemainingDays: formatRemainingDays(expirationDate),
      autoRenew,
      billingIssue: isBillingProblem,
      store: typeof store === "string" ? store.toUpperCase() : "PLAY_STORE",
      managementURL,
      isLoading: subscriptionQuery.isPending && !activeEnt && !backendData,
      isError: hasError,
      refetch: subscriptionQuery.refetch,
    };
  }, [user, isSubscribed, hasBillingIssue, customerInfo, subscriptionQuery]);
}
