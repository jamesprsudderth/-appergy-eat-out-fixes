/**
 * Shared API Response Envelope
 *
 * All API responses use this format:
 *   Success: { ok: true, data: T, requestId }
 *   Error:   { ok: false, error: { code, message }, requestId }
 */

import type { Response } from "express";

export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

export type ApiEnvelope<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const requestId: string = res.locals.requestId ?? "unknown";
  res.status(status).json({
    ok: true,
    data,
    requestId,
  });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 500,
): void {
  const requestId: string = res.locals.requestId ?? "unknown";
  res.status(status).json({
    ok: false,
    error: { code, message },
    requestId,
  });
}

/* ── Backward-compatible helpers ──
 * If the client sends "x-api-envelope: 1", respond with the standard
 * { ok, data/error, requestId } envelope.  Otherwise fall back to the
 * legacy raw-JSON shape so existing mobile clients keep working.
 */

function wantsEnvelope(res: Response): boolean {
  return res.req?.headers["x-api-envelope"] === "1";
}

export function respond(res: Response, data: unknown, status = 200): void {
  if (wantsEnvelope(res)) {
    sendSuccess(res, data, status);
  } else {
    res.status(status).json(data);
  }
}

export function respondError(
  res: Response,
  code: string,
  message: string,
  status: number,
): void {
  if (wantsEnvelope(res)) {
    sendError(res, code, message, status);
  } else {
    res.status(status).json({ error: message });
  }
}
