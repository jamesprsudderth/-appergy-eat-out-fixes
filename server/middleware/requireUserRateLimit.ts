/**
 * Per-user hourly AI rate limiter — Express middleware.
 *
 * Must be applied AFTER requireAuth so that res.locals.uid is populated.
 *
 * On every request it atomically increments the user's Firestore counter
 * and returns 429 if the hourly limit is exceeded.
 *
 * Sets standard rate-limit response headers:
 *   X-RateLimit-Limit     — maximum requests per hour
 *   X-RateLimit-Remaining — remaining requests in the current window
 *
 * If Firestore is temporarily unavailable the middleware fails open
 * (logs the error and calls next()) so a transient infra issue never
 * blocks legitimate users.
 */

import type { Request, Response, NextFunction } from "express";
import { checkAndIncrement } from "../lib/userRateLimiter";
import { logError } from "../lib/logger";
import { respondError } from "../lib/apiResponse";

const DEFAULT_HOURLY_LIMIT = 20;

/**
 * Returns an Express middleware that enforces a per-user hourly request limit.
 *
 * @param maxPerHour  Defaults to 20 (override via AI_RATE_LIMIT_HOURLY env var).
 */
export function createUserRateLimiter(maxPerHour = DEFAULT_HOURLY_LIMIT) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const uid = res.locals.uid as string | undefined;

    // requireAuth runs before this — uid should always be present.
    // Guard anyway in case the middleware order is changed.
    if (!uid) {
      respondError(res, "UNAUTHORIZED", "Missing user identity", 401);
      return;
    }

    try {
      const result = await checkAndIncrement(uid, maxPerHour);

      res.setHeader("X-RateLimit-Limit", result.limit);
      res.setHeader("X-RateLimit-Remaining", result.remaining);

      if (!result.allowed) {
        respondError(
          res,
          "RATE_LIMITED",
          `Hourly AI limit of ${result.limit} requests reached. Resets at the top of the next hour.`,
          429,
        );
        return;
      }

      next();
    } catch (error) {
      // Fail open: a Firestore error should not deny service to the user.
      logError("User rate limiter Firestore error — failing open", {
        uid,
        error: String(error),
      });
      next();
    }
  };
}
