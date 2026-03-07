/**
 * Per-user AI rate limiter backed by Firestore.
 *
 * Each user gets one counter document:
 *   users/{uid}/rateLimit/ai
 *   { windowKey: string, count: number }
 *
 * windowKey is the number of complete hours elapsed since the Unix epoch
 * (Math.floor(Date.now() / 3_600_000)), which gives a new fixed window every
 * calendar hour UTC.  When the window rolls over the counter is reset to 1.
 *
 * The increment is done inside a Firestore transaction so concurrent requests
 * on the same user are serialised — the final count is always accurate.
 *
 * The caller decides what to do with the result; this module only tracks usage.
 * On any Firestore error the caller should fail open (let the request through)
 * to avoid blocking users due to infrastructure hiccups.
 */

import { getAdminApp } from "./firebaseAdmin";

const RATELIMIT_COLLECTION = "rateLimit";
const AI_DOC_ID = "ai";

/** Returns the current fixed-window key (unique per UTC hour). */
function windowKey(): string {
  return String(Math.floor(Date.now() / 3_600_000));
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;   // count AFTER this request is recorded
  limit: number;
  remaining: number;
}

/**
 * Atomically increments the per-user hourly AI counter and returns whether
 * the request is within the allowed limit.
 *
 * @param uid        Firebase user UID (used as Firestore document key).
 * @param maxPerHour Maximum AI calls allowed per user per hour.
 */
export async function checkAndIncrement(
  uid: string,
  maxPerHour: number,
): Promise<RateLimitResult> {
  const db = getAdminApp().firestore();
  const docRef = db.doc(`users/${uid}/${RATELIMIT_COLLECTION}/${AI_DOC_ID}`);
  const currentWindow = windowKey();

  let newCount = 1;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);

    if (snap.exists && snap.data()!.windowKey === currentWindow) {
      // Same hour — increment existing counter.
      newCount = (snap.data()!.count as number) + 1;
      tx.update(docRef, { count: newCount });
    } else {
      // New hour (or first ever request) — start fresh.
      newCount = 1;
      tx.set(docRef, { windowKey: currentWindow, count: 1 });
    }
  });

  return {
    allowed: newCount <= maxPerHour,
    count: newCount,
    limit: maxPerHour,
    remaining: Math.max(0, maxPerHour - newCount),
  };
}
