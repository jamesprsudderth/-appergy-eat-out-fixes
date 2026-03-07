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
import { auth, signOut } from "./firebase";
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

  const buildHeaders = (token: string): Record<string, string> => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    };
    if (appCheckToken) h["X-Firebase-AppCheck"] = appCheckToken;
    return h;
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(idToken),
  });

  // On 401, force-refresh the token once and retry. This handles the common
  // case where the cached token expired between fetches. If the retry also
  // returns 401 the session is no longer valid (revoked / account disabled)
  // so sign the user out to prevent an infinite loop.
  if (response.status === 401) {
    try {
      const freshToken = await user.getIdToken(true);
      const retried = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(freshToken),
      });

      if (retried.status === 401 && auth) {
        await signOut(auth);
      }

      return retried;
    } catch {
      if (auth) await signOut(auth);
      throw new Error("Session expired. Please sign in again.");
    }
  }

  return response;
}
