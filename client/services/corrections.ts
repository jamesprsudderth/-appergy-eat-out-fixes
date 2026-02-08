/*
 * Corrections Service
 *
 * Manages user corrections to scan results.
 * Spec: Corrections persist and are logged for investigation.
 *
 * Firestore path: users/{userId}/corrections/{correctionId}
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export interface CorrectionDoc {
  sessionId: string;
  itemFingerprint: string | null;
  before: {
    status: string;
    allergens: string[];
    preferences: string[];
  };
  after: {
    status: string;
    allergens: string[];
    preferences: string[];
  };
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Persist a correction document logging before/after state.
 * Spec: Correction is logged and applied locally.
 */
export async function persistCorrection(
  userId: string,
  correction: Omit<CorrectionDoc, "createdAt">,
): Promise<string | null> {
  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping correction persist");
    return null;
  }

  try {
    const correctionsRef = collection(db, "users", userId, "corrections");
    const docRef = await addDoc(correctionsRef, {
      ...correction,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error persisting correction:", error);
    return null;
  }
}
