import type { Request, Response, NextFunction } from "express";
import { getAdminApp } from "../lib/firebaseAdmin";
import { sendError } from "../lib/apiResponse";

/**
 * Verifies the Firebase App Check token on every request.
 *
 * App Check attests that the request originates from a genuine build of your
 * app on a real device (DeviceCheck on iOS, Play Integrity on Android).
 * This is a different and complementary check to requireAuth, which verifies
 * the identity of the individual USER.
 *
 * Gate order in routes.ts:
 *   1. requireAppCheck — is this a real, unmodified app binary?
 *   2. requireAuth     — is this a real, authenticated user?
 *
 * Expects:  X-Firebase-AppCheck: <app-check-token>
 *
 * In development (Expo Go / simulator) the client sends no token because
 * App Check native attestation is unavailable. Set NODE_ENV=development to
 * skip enforcement locally; the middleware always enforces in production.
 */
export async function requireAppCheck(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Skip enforcement in development so Expo Go and simulators still work.
  // App Check is always enforced in production (Cloud Run).
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const appCheckToken = req.headers["x-firebase-appcheck"] as string | undefined;

  if (!appCheckToken) {
    sendError(res, "APP_CHECK_FAILED", "Missing App Check token", 401);
    return;
  }

  try {
    await getAdminApp().appCheck().verifyToken(appCheckToken);
    next();
  } catch {
    sendError(res, "APP_CHECK_FAILED", "Invalid or expired App Check token", 401);
  }
}
