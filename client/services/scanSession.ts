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
import { updateSessionAttemptCounters } from "../../src/services/scanHelpers";

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

export type ResultStatus = "safe" | "unsafe" | "manual_review_required";

export interface ScanAttempt {
  attemptNumber: number;
  imageHash: string | null;
  ocrText: string | null;
  resultStatus: ResultStatus;
  manualReviewReason: string | null;
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Persist a scan attempt under the session.
 * Spec §2.4: Attempts are written even when result is MRR.
 * Path: users/{userId}/scanSessions/{sessionId}/attempts/{attemptId}
 */
export async function persistScanAttempt(
  userId: string,
  sessionId: string,
  attempt: Omit<ScanAttempt, "createdAt">,
): Promise<string | null> {
  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping attempt persist");
    return null;
  }

  try {
    const attemptsRef = collection(
      db,
      "users",
      userId,
      "scanSessions",
      sessionId,
      "attempts",
    );

    const attemptData: ScanAttempt = {
      ...attempt,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(attemptsRef, attemptData);
    return docRef.id;
  } catch (error) {
    console.error("Error persisting scan attempt:", error);
    return null;
  }
}

export interface LatestResultProfile {
  profileId: string;
  name: string;
  status: string;
  allergens: string[];
  preferences: string[];
  inferredRisks: string[];
}

export interface LatestResult {
  status: ResultStatus;
  manualReviewReason: string | null;
  itemName: string | null;
  itemFingerprint: string | null;
  ingredientsExplicit: string[];
  ingredientsInferred: string[];
  profiles: LatestResultProfile[];
  createdAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Write result/latest on every attempt (including MRR).
 * Spec §2.5: Always write, data shape matches spec.
 * Path: users/{userId}/scanSessions/{sessionId}/result/latest
 */
export async function persistLatestResult(
  userId: string,
  sessionId: string,
  result: Omit<LatestResult, "createdAt">,
): Promise<boolean> {
  if (!db || !isFirebaseConfigured) {
    console.log("Firebase not configured, skipping result persist");
    return false;
  }

  try {
    const resultRef = doc(
      db,
      "users",
      userId,
      "scanSessions",
      sessionId,
      "result",
      "latest",
    );

    await setDoc(resultRef, {
      ...result,
      createdAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error persisting latest result:", error);
    return false;
  }
}

export interface SessionCounterState {
  attemptCount: number;
  manualReviewCount: number;
  escalationShown: boolean;
}

/**
 * Update session attempt counters and persist to Firestore.
 * Uses updateSessionAttemptCounters from scanHelpers.
 * Spec §1: 3-fail MRR escalation
 *  - manualReviewCount increments ONLY on MRR
 *  - resets on safe/unsafe
 *  - Escalation triggers at exactly 3 consecutive MRR
 *
 * Returns { shouldShowEscalation, updatedCounters }
 */
export async function updateAndPersistSessionCounters(
  userId: string,
  sessionId: string,
  currentCounters: SessionCounterState,
  isMRR: boolean,
): Promise<{
  shouldShowEscalation: boolean;
  counters: SessionCounterState;
}> {
  const result = updateSessionAttemptCounters(currentCounters, isMRR);

  const updatedCounters: SessionCounterState = {
    attemptCount: result.attemptCount,
    manualReviewCount: result.manualReviewCount,
    escalationShown: result.escalationShown,
  };

  if (db && isFirebaseConfigured) {
    try {
      const sessionRef = doc(
        db,
        "users",
        userId,
        "scanSessions",
        sessionId,
      );
      await updateDoc(sessionRef, {
        attemptCount: updatedCounters.attemptCount,
        manualReviewCount: updatedCounters.manualReviewCount,
        escalationShown: updatedCounters.escalationShown,
      });
    } catch (error) {
      console.error("Error updating session counters:", error);
    }
  }

  return {
    shouldShowEscalation: result.shouldShowEscalation,
    counters: updatedCounters,
  };
}
