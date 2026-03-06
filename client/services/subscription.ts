/*
 * Subscription Service
 *
 * Wraps the RevenueCat SDK (react-native-purchases).
 * Call configureRevenueCat(uid) after Firebase sign-in, and
 * logOutRevenueCat() on sign-out.
 *
 * RevenueCat entitlement IDs must match what is configured in the
 * RevenueCat dashboard:  "individual"  and  "family".
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

export interface SubscriptionInfo {
  tier: "free" | "individual" | "family";
  isActive: boolean;
  expiresAt?: string;
  maxProfiles: number;
}

export const PLAN_DETAILS = {
  free: {
    name: "Free",
    price: "Free",
    maxProfiles: 1,
    maxScansPerDay: 3,
    features: ["Basic label scanning", "1 profile"],
  },
  individual: {
    name: "Individual",
    price: "$4.99/mo",
    maxProfiles: 1,
    maxScansPerDay: -1, // unlimited
    features: [
      "Unlimited label scanning",
      "Menu scanning",
      "Barcode scanning",
      "Scan history",
      "Recipe generation",
    ],
  },
  family: {
    name: "Family",
    price: "$9.99/mo",
    maxProfiles: 5,
    maxScansPerDay: -1,
    features: [
      "Everything in Individual",
      "Up to 5 family profiles",
      "Family scan results",
    ],
  },
} as const;

// Must match entitlement IDs in the RevenueCat dashboard
const ENTITLEMENT_INDIVIDUAL = "individual";
const ENTITLEMENT_FAMILY = "family";

let configuredUserId: string | null = null;

/**
 * Configure the RevenueCat SDK for the given Firebase UID.
 * Safe to call multiple times — re-configures only when the user changes.
 */
export function configureRevenueCat(appUserId: string): void {
  if (configuredUserId === appUserId) return;

  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
    default: "",
  })!;

  if (!apiKey) {
    console.warn(
      "[RevenueCat] API key not configured. " +
        "Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY."
    );
    return;
  }

  Purchases.configure({ apiKey, appUserID: appUserId });
  configuredUserId = appUserId;
}

/** Call on sign-out so the next user starts fresh. */
export async function logOutRevenueCat(): Promise<void> {
  configuredUserId = null;
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if the SDK was never configured; safe to ignore.
  }
}

function tierFromCustomerInfo(
  customerInfo: CustomerInfo
): SubscriptionInfo["tier"] {
  if (customerInfo.entitlements.active[ENTITLEMENT_FAMILY]) return "family";
  if (customerInfo.entitlements.active[ENTITLEMENT_INDIVIDUAL])
    return "individual";
  return "free";
}

export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  if (!configuredUserId) {
    return {
      tier: "free",
      isActive: false,
      maxProfiles: PLAN_DETAILS.free.maxProfiles,
    };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const tier = tierFromCustomerInfo(customerInfo);
    const activeEntitlement =
      customerInfo.entitlements.active[ENTITLEMENT_FAMILY] ??
      customerInfo.entitlements.active[ENTITLEMENT_INDIVIDUAL];
    return {
      tier,
      isActive: tier !== "free",
      expiresAt: activeEntitlement?.expirationDate ?? undefined,
      maxProfiles: PLAN_DETAILS[tier].maxProfiles,
    };
  } catch (error) {
    console.error("[RevenueCat] getCustomerInfo failed:", error);
    return {
      tier: "free",
      isActive: false,
      maxProfiles: PLAN_DETAILS.free.maxProfiles,
    };
  }
}

export function canAddFamilyMember(
  currentCount: number,
  subscription: SubscriptionInfo
): boolean {
  return currentCount < subscription.maxProfiles;
}

export async function purchaseSubscription(
  tier: "individual" | "family"
): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      console.error("[RevenueCat] No current offering available");
      return false;
    }

    // Prefer a package whose identifier matches the tier slug, then fall back
    // to package type (MONTHLY for individual, ANNUAL for family).
    const pkg: PurchasesPackage | undefined =
      current.availablePackages.find((p) => p.identifier === tier) ??
      current.availablePackages.find((p) =>
        tier === "individual"
          ? p.packageType === "MONTHLY"
          : p.packageType === "ANNUAL"
      ) ??
      current.availablePackages[0];

    if (!pkg) {
      console.error("[RevenueCat] No package found for tier:", tier);
      return false;
    }

    await Purchases.purchasePackage(pkg);
    return true;
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error("[RevenueCat] Purchase failed:", error);
    }
    return false;
  }
}

export async function restorePurchases(): Promise<SubscriptionInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const tier = tierFromCustomerInfo(customerInfo);
    const activeEntitlement =
      customerInfo.entitlements.active[ENTITLEMENT_FAMILY] ??
      customerInfo.entitlements.active[ENTITLEMENT_INDIVIDUAL];
    return {
      tier,
      isActive: tier !== "free",
      expiresAt: activeEntitlement?.expirationDate ?? undefined,
      maxProfiles: PLAN_DETAILS[tier].maxProfiles,
    };
  } catch (error) {
    console.error("[RevenueCat] Restore purchases failed:", error);
    return null;
  }
}
