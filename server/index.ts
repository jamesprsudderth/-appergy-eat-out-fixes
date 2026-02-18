import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { validateEnv } from "./lib/envValidation";
import { requestIdMiddleware } from "./middleware/requestId";
import { logRequest, logInfo, logWarn, logError } from "./lib/logger";
import { createRateLimiter } from "./middleware/rateLimiter";
import { sendError } from "./lib/apiResponse";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "10mb", // Base64 images can be large
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
}


function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  // First, check if we have a static build (production)
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (fs.existsSync(manifestPath)) {
    res.setHeader("expo-protocol-version", "1");
    res.setHeader("expo-sfv-version", "0");
    res.setHeader("content-type", "application/json");
    const manifest = fs.readFileSync(manifestPath, "utf-8");
    return res.send(manifest);
  }

  // Dev mode: proxy to the Expo dev server (usually port 8081)
  const expoDevPort = process.env.EXPO_DEV_PORT || "8081";
  const expoDevUrl = `http://localhost:${expoDevPort}`;

  logInfo(`No static build found, proxying manifest to Expo dev server at ${expoDevUrl}`);

  // Forward the request to the Expo dev server
  const proxyUrl = `${expoDevUrl}${req.path}`;
  fetch(proxyUrl, {
    headers: {
      "expo-platform": platform,
      "expo-protocol-version": "1",
    },
  })
    .then(async (proxyRes) => {
      if (!proxyRes.ok) {
        throw new Error(`Expo dev server returned ${proxyRes.status}`);
      }
      const body = await proxyRes.text();
      // Forward relevant headers
      const contentType = proxyRes.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);
      const epv = proxyRes.headers.get("expo-protocol-version");
      if (epv) res.setHeader("expo-protocol-version", epv);
      const esv = proxyRes.headers.get("expo-sfv-version");
      if (esv) res.setHeader("expo-sfv-version", esv);
      res.send(body);
    })
    .catch((err) => {
      logWarn(`Expo dev server proxy failed: ${err.message}`);
      res.status(404).json({
        error: `Manifest not found for platform: ${platform}. ` +
          `Make sure the Expo dev server is running (npm run expo:dev) ` +
          `or build static files first (npm run expo:static:build).`,
      });
    });
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  logInfo("Landing page URLs", { baseUrl, expsUrl });

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );

  let landingPageTemplate = "<html><body><h1>Appergy Server Running</h1><p>Connect via Expo Go.</p></body></html>";
  try {
    landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  } catch {
    logWarn("landing-page.html not found, using fallback");
  }

  const appName = getAppName();

  logInfo("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  logInfo("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    logError("Internal Server Error", { error: String(err) });

    if (res.headersSent) {
      return next(err);
    }

    sendError(res, "INTERNAL_ERROR", message, status);
  });
}

(async () => {
  const env = validateEnv();

  setupCors(app);
  setupBodyParsing(app);

  // requestId first so logRequest and route handlers can read it
  app.use(requestIdMiddleware);
  app.use(logRequest);

  // Rate-limit only the heavy image-analysis endpoints
  const apiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
  app.use("/api/analyze-image", apiLimiter);
  app.use("/api/analyze-menu", apiLimiter);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app, { openaiApiKey: env.OPENAI_API_KEY });

  setupErrorHandler(app);

  server.listen(
    {
      port: env.PORT,
      host: "0.0.0.0",
    },
    () => {
      logInfo(`Server listening on port ${env.PORT}`);
    },
  );
})();
