import type { Request, Response, NextFunction } from "express";
import { verifyIdToken } from "../lib/firebaseAdmin";
import { sendError } from "../lib/apiResponse";

/**
 * Verifies the Firebase ID token on every request.
 *
 * Expects:  Authorization: Bearer <firebase-id-token>
 * On success: sets res.locals.uid to the verified user's UID and calls next().
 * On failure: responds 401 immediately.
 *
 * Client usage:
 *   const token = await firebase.auth().currentUser?.getIdToken();
 *   fetch("/api/...", { headers: { Authorization: `Bearer ${token}` } });
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "UNAUTHORIZED", "Authorization header missing or malformed", 401);
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await verifyIdToken(token);
    res.locals.uid = decoded.uid;
    next();
  } catch {
    sendError(res, "UNAUTHORIZED", "Invalid or expired Firebase ID token", 401);
  }
}
