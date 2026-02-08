/*
 * Admin Alerts Service
 *
 * Spec §4 (Locked): Create alert ONLY if allergens are involved.
 * Never trigger for preferences-only or MRR-only without allergen evidence.
 *
 * Firestore path: users/{userId}/adminAlerts/{alertId}
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import {
  shouldCreateAdminAlert,
  type AnalysisResult,
} from "../../src/services/scanHelpers";

export interface AdminAlert {
  sessionId: string;
  summary: string;
  allergens: string[];
  profileIds: string[];
  isRead: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Build a plain-language summary for an alert.
 */
function buildAlertSummary(allergens: string[]): string {
  if (allergens.length === 0) return "";
  if (allergens.length === 1) return `Contains ${allergens[0]}`;
  return `Contains ${allergens.slice(0, -1).join(", ")} and ${allergens[allergens.length - 1]}`;
}

/**
 * Create an admin alert if allergens are involved.
 * Uses shouldCreateAdminAlert from scanHelpers.
 * Spec: Never alert for preferences-only or MRR-only.
 */
export async function createAdminAlertIfNeeded(
  userId: string,
  sessionId: string,
  analysisResult: AnalysisResult,
  profileIds: string[],
): Promise<string | null> {
  // Check if alert should be created using spec rule
  if (!shouldCreateAdminAlert(analysisResult)) {
    return null;
  }

  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping alert creation");
    return null;
  }

  const allergens = analysisResult.allergensDetected.map((a) => a.allergenId);
  const summary = buildAlertSummary(allergens);

  try {
    const alertsRef = collection(db, "users", userId, "adminAlerts");
    const alertData: AdminAlert = {
      sessionId,
      summary,
      allergens,
      profileIds,
      isRead: false,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(alertsRef, alertData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating admin alert:", error);
    return null;
  }
}
