import type { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/apiResponse";

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

interface WindowEntry {
  count: number;
  expiresAt: number;
}

const CLEANUP_THRESHOLD = 10_000;

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip ?? "unknown";
}

/**
 * Creates an Express middleware that limits requests per client IP
 * using a fixed-window counter stored in memory.
 */
export function createRateLimiter({ windowMs, maxRequests }: RateLimiterOptions) {
  const windows = new Map<string, WindowEntry>();

  function sweep(now: number): void {
    for (const [k, v] of windows) {
      if (now >= v.expiresAt) windows.delete(k);
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientIp(req);
    const now = Date.now();

    if (windows.size > CLEANUP_THRESHOLD) sweep(now);

    const entry = windows.get(key);

    if (!entry || now >= entry.expiresAt) {
      windows.set(key, { count: 1, expiresAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      sendError(res, "RATE_LIMITED", "Too many requests", 429);
      return;
    }

    entry.count++;
    next();
  };
}
