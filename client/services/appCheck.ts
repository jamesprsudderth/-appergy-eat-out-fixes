/**
 * Firebase App Check — DeviceCheck (iOS) + Play Integrity (Android)
 *
 * PREREQUISITES (one-time setup before this code does anything useful):
 *  1. Firebase Console → App Check → Register your iOS and Android apps.
 *  2. Add google-services.json (Android) to the project root.
 *  3. Add GoogleService-Info.plist (iOS) to the project root.
 *  4. Set ios.bundleIdentifier and android.package in app.json.
 *  5. Add @react-native-firebase/app and @react-native-firebase/app-check
 *     config plugins to app.json (already done).
 *  6. Build with EAS: `eas build --profile development` — App Check uses
 *     native attestation that is not available in Expo Go.
 *
 * DEBUG TOKENS (for simulators / CI):
 *  - On first run in __DEV__ mode the RNFB SDK prints a debug token to the
 *    console. Register that token in Firebase Console → App Check →
 *    [your app] → Manage debug tokens.
 *  - Optionally set EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN in .env to pin a
 *    specific token instead of letting RNFB generate one.
 */

import { initializeAppCheck, getToken, type AppCheck } from "firebase/app-check";
import { app } from "./firebase";
import rnfbApp from "@react-native-firebase/app";
import { Platform } from "react-native";

let _appCheck: AppCheck | null = null;

export function initAppCheck(): void {
  if (_appCheck) return; // already initialized

  // newReactNativeFirebaseAppCheckProvider() wires up the native attestation
  // APIs — DeviceCheck on iOS, Play Integrity on Android — and implements the
  // AppCheckProvider interface accepted by the Firebase JS SDK directly.
  const rnfbProvider = rnfbApp
    .appCheck()
    .newReactNativeFirebaseAppCheckProvider();

  rnfbProvider.configure({
    android: {
      // Play Integrity is the default for production Android builds.
      // 'debug' uses a local debug token (printed to logcat on first run).
      provider: __DEV__ ? "debug" : "playIntegrity",
      debugToken: process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN,
    },
    apple: {
      // DeviceCheck is the default for production iOS builds (requires a real
      // device; debug provider is used on simulators / Expo Go).
      provider: __DEV__ ? "debug" : "deviceCheck",
      debugToken: process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN,
    },
    isTokenAutoRefreshEnabled: true,
  });

  _appCheck = initializeAppCheck(app, {
    provider: rnfbProvider,
    isTokenAutoRefreshEnabled: true,
  });
}

/**
 * Returns the current App Check token string, or null if App Check has not
 * been initialized (e.g. running in Expo Go without a custom dev build).
 *
 * Uses getToken(false) — returns the cached token unless it is within
 * ~5 minutes of expiry, matching the same policy as getIdToken(false).
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!_appCheck) return null;
  try {
    const { token } = await getToken(_appCheck, /* forceRefresh= */ false);
    return token;
  } catch {
    // Non-fatal: App Check failure should not block the user in cases where
    // the server is configured to allow missing tokens (e.g. during rollout).
    return null;
  }
}
