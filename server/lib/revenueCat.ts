/**
 * RevenueCat server-side helper.
 *
 * Uses the RevenueCat REST v1 API to fetch a subscriber's entitlements.
 * The secret key must be set via the REVENUECAT_SECRET_KEY environment variable.
 *
 * Entitlement IDs ("individual", "family") must match those in the
 * RevenueCat dashboard.
 */

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

export interface VerifiedSubscription {
  tier: "free" | "individual" | "family";
  isActive: boolean;
  expiresAt?: string;
}

/**
 * Fetch the subscriber record from RevenueCat and return the highest active
 * entitlement tier.
 *
 * @param appUserId  The Firebase UID used as the RevenueCat App User ID.
 * @param secretKey  The RevenueCat secret (server-side) API key.
 */
export async function getSubscriberEntitlements(
  appUserId: string,
  secretKey: string
): Promise<VerifiedSubscription> {
  const url = `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(
      `RevenueCat API error: ${resp.status} ${resp.statusText}`
    );
  }

  const data: any = await resp.json();
  const entitlements: Record<string, any> =
    data.subscriber?.entitlements ?? {};

  const now = new Date();
  const isEntitlementActive = (e: any): boolean =>
    !!e && (!e.expires_date || new Date(e.expires_date) > now);

  if (isEntitlementActive(entitlements["family"])) {
    return {
      tier: "family",
      isActive: true,
      expiresAt: entitlements["family"].expires_date ?? undefined,
    };
  }

  if (isEntitlementActive(entitlements["individual"])) {
    return {
      tier: "individual",
      isActive: true,
      expiresAt: entitlements["individual"].expires_date ?? undefined,
    };
  }

  return { tier: "free", isActive: false };
}
