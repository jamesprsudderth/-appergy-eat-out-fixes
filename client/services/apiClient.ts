/**
 * Authenticated fetch wrapper for all server API calls.
 *
 * Attaches two security headers on every request:
 *  - Authorization: Bearer <Firebase ID token>   — identifies the USER
 *  - X-Firebase-AppCheck: <App Check token>       — attests the APP/DEVICE
 *
 * Both use the cached-token pattern (false / forceRefresh=false) so Firebase
 * is only contacted when a token is within ~5 minutes of expiry.
 */
import { auth } from "./firebase";
import { getAppCheckToken } from "./appCheck";

export const API_BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:5000";

/**
 * Drop-in replacement for fetch() that attaches Authorization and
 * X-Firebase-AppCheck headers. Throws if no user is currently signed in.
 *
 * @param path    Server-relative path, e.g. "/api/analyze-image"
 * @param options Standard RequestInit (do NOT set the auth headers — injected here)
 */
export async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("authFetch: no authenticated user");
  }

  // Fetch both tokens concurrently — they are cached independently
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(false),   // false = use cache unless near expiry
    getAppCheckToken(),        // null in Expo Go / if App Check not initialized
  ]);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${idToken}`,
  };

  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
