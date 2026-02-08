/*
 * User Overrides Service
 *
 * Manages user overrides (corrections) for scan results.
 * Spec: Overrides apply immediately and only affect the correcting user.
 *
 * Firestore path: users/{userId}/overrides/{userId}_{itemFingerprint}
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import {
  applyUserOverrideToResult,
  type AnalysisResult,
} from "../../src/services/scanHelpers";

export interface UserOverride {
  userId: string;
  itemFingerprint: string;
  overridePayload: Partial<AnalysisResult>;
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Lookup override by userId + itemFingerprint.
 * Override key: ${userId}_${itemFingerprint}
 */
export async function lookupOverride(
  userId: string,
  itemFingerprint: string,
): Promise<Partial<AnalysisResult> | null> {
  if (!db || !isFirebaseConfigured) return null;

  try {
    const overrideId = `${userId}_${itemFingerprint}`;
    const overrideRef = doc(db, "users", userId, "overrides", overrideId);
    const snap = await getDoc(overrideRef);

    if (snap.exists()) {
      return snap.data().overridePayload as Partial<AnalysisResult>;
    }
    return null;
  } catch (error) {
    console.error("Error looking up override:", error);
    return null;
  }
}

/**
 * Apply an existing override to the analysis result.
 * Uses applyUserOverrideToResult from scanHelpers.
 * Marks corrected findings as source=user_corrected.
 */
export function applyOverride(
  result: AnalysisResult,
  overridePayload: Partial<AnalysisResult>,
): AnalysisResult {
  return applyUserOverrideToResult(result, overridePayload);
}

/**
 * Save an override for future scans.
 * Path: users/{userId}/overrides/{userId}_{itemFingerprint}
 */
export async function saveOverride(
  userId: string,
  itemFingerprint: string,
  overridePayload: Partial<AnalysisResult>,
): Promise<boolean> {
  if (!db || !isFirebaseConfigured) return false;

  try {
    const overrideId = `${userId}_${itemFingerprint}`;
    const overrideRef = doc(db, "users", userId, "overrides", overrideId);
    await setDoc(overrideRef, {
      userId,
      itemFingerprint,
      overridePayload,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error saving override:", error);
    return false;
  }
}

/**
 * Check if a result has been corrected by the user.
 */
export function isUserCorrected(result: AnalysisResult): boolean {
  return (
    Array.isArray(result.dietaryFlags) &&
    result.dietaryFlags.includes("user_corrected")
  );
}
