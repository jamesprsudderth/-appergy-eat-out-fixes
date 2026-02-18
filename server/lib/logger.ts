/**
 * Structured Logger
 *
 * JSON log lines with route, latency, and requestId.
 * Also exports a middleware that logs after each response finishes.
 */

import type { Request, Response, NextFunction } from "express";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  method?: string;
  route?: string;
  statusCode?: number;
  latencyMs?: number;
  requestId?: string;
  message?: string;
  [key: string]: unknown;
}

export function log(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(
  message: string,
  extra?: Record<string, unknown>,
): void {
  log({ timestamp: new Date().toISOString(), level: "info", message, ...extra });
}

export function logWarn(
  message: string,
  extra?: Record<string, unknown>,
): void {
  log({ timestamp: new Date().toISOString(), level: "warn", message, ...extra });
}

export function logError(
  message: string,
  extra?: Record<string, unknown>,
): void {
  log({ timestamp: new Date().toISOString(), level: "error", message, ...extra });
}

/**
 * Express middleware that logs a structured JSON line after each
 * response finishes. Only logs /api routes to avoid noise from
 * static assets and landing page requests.
 */
export function logRequest(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;

    const level = res.statusCode >= 500 ? "error"
      : res.statusCode >= 400 ? "warn"
      : "info";

    log({
      timestamp: new Date().toISOString(),
      level,
      method: req.method,
      route: req.originalUrl,
      statusCode: res.statusCode,
      latencyMs: Date.now() - start,
      requestId: res.locals.requestId ?? "unknown",
    });
  });

  next();
}
