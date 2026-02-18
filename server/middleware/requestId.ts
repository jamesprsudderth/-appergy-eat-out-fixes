/**
 * Request ID Middleware
 *
 * Assigns a unique ID to each request for tracing.
 * Reads x-request-id from the incoming header if present,
 * otherwise generates a UUID. Stored in res.locals.requestId
 * and echoed back as a response header.
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" ? incoming : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
