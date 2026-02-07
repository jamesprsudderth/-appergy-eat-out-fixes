/*
 * Subscription Service
 *
 * Handles subscription status and plan gating.
 * Will integrate with RevenueCat for production.
 */

export interface SubscriptionInfo {
  tier: "free" | "individual" | "family";
  isActive: boolean;
  expiresAt?: string;
  maxProfiles: number;
}

export const PLAN_DETAILS = {
  free: {
    name: "Free",
    maxProfiles: 1,
    maxScansPerDay: 3,
    features: ["Basic label scanning", "1 profile"],
  },
  individual: {
    name: "Individual",
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
    maxProfiles: 5,
    maxScansPerDay: -1,
    features: [
      "Everything in Individual",
      "Up to 5 family profiles",
      "Family scan results",
    ],
  },
} as const;

export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  // TODO: Integrate with RevenueCat
  // For now return a default tier
  return {
    tier: "individual",
    isActive: true,
    maxProfiles: PLAN_DETAILS.individual.maxProfiles,
  };
}

export function canAddFamilyMember(
  currentCount: number,
  subscription: SubscriptionInfo
): boolean {
  return currentCount < subscription.maxProfiles;
}

export async function purchaseSubscription(
  _tier: "individual" | "family"
): Promise<boolean> {
  // TODO: RevenueCat purchase flow
  console.log("Subscription purchase not yet implemented");
  return false;
}

export async function restorePurchases(): Promise<SubscriptionInfo | null> {
  // TODO: RevenueCat restore
  console.log("Restore purchases not yet implemented");
  return null;
}
