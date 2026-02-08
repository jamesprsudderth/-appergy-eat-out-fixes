/*
 * Scan Session Service
 *
 * Manages scan session lifecycle in Firestore per spec:
 * docs/scan-state-machine-firestore-model-results-ux.md
 *
 * Firestore path: users/{userId}/scanSessions/{sessionId}
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export type ScanSessionStatus = "in_progress" | "completed" | "abandoned";

export interface ScanSession {
  initiatedByUserId: string;
  scanType: string;
  selectedProfileIds: string[];
  attemptCount: number;
  manualReviewCount: number;
  escalationShown: boolean;
  itemNameGuess: string | null;
  itemNameConfirmed: string | null;
  itemFingerprint: string | null;
  status: ScanSessionStatus;
  createdAt: ReturnType<typeof serverTimestamp>;
  endedAt: ReturnType<typeof serverTimestamp> | null;
}

/**
 * Create a new scan session on scan start.
 * Spec §2.3: Session Start
 *  - attemptCount = 0
 *  - manualReviewCount = 0
 *  - escalationShown = false
 *  - status = "in_progress"
 */
export async function createScanSession(
  userId: string,
  scanType: string,
  selectedProfileIds: string[],
): Promise<string | null> {
  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping session creation");
    return null;
  }

  try {
    const sessionsRef = collection(db, "users", userId, "scanSessions");

    const sessionData: ScanSession = {
      initiatedByUserId: userId,
      scanType,
      selectedProfileIds,
      attemptCount: 0,
      manualReviewCount: 0,
      escalationShown: false,
      itemNameGuess: null,
      itemNameConfirmed: null,
      itemFingerprint: null,
      status: "in_progress",
      createdAt: serverTimestamp(),
      endedAt: null,
    };

    const docRef = await addDoc(sessionsRef, sessionData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating scan session:", error);
    return null;
  }
}
