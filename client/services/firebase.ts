import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  OAuthProvider,
  signInWithCredential,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe,
} from "firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "appergy-24baa.firebaseapp.com",
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "appergy-24baa",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "appergy-24baa.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "428375662628",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    "1:428375662628:web:2d97181a959807a1a178b1",
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ZSGKXL83QW",
};

const isValidApiKey = (key: string | undefined): boolean => {
  if (!key) return false;
  if (key.includes("process.env")) return false;
  if (key.includes("placeholder")) return false;
  if (key.length < 10) return false;
  return true;
};

export const isFirebaseConfigured = Boolean(
  isValidApiKey(firebaseConfig.apiKey) &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // initializeAuth (not getAuth) must be called on first init so we can
    // supply AsyncStorage persistence. getAuth on a fresh app would default
    // to in-memory persistence, logging the user out on every app restart.
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    app = getApps()[0];
    // App already initialized (e.g. hot reload) — retrieve existing Auth
    // instance; calling initializeAuth again would throw.
    auth = getAuth(app);
  }

  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const isFirebaseReady = Boolean(app && auth && db);

export { auth, db };
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
export type { User, Unsubscribe };

// ─── Apple Sign-In ────────────────────────────────────────────────────────────

/** Returns true when running on iOS 13+ (the only platform that supports Apple Sign-In). */
export const isAppleSignInAvailable = AppleAuthentication.isAvailableAsync;

/**
 * Perform an Apple Sign-In and return a Firebase User.
 * Throws `AppleAuthentication.AppleAuthenticationError` on cancellation so
 * callers can distinguish cancel from a real error.
 */
export async function signInWithApple(): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not initialized.");

  // Generate a cryptographically-random nonce and its SHA-256 hash.
  // Apple uses the hash to bind the credential; Firebase needs the raw value.
  const rawNonce = Array.from(
    Crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");

  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const provider = new OAuthProvider("apple.com");
  const oauthCredential = provider.credential({
    idToken: appleCredential.identityToken!,
    rawNonce,
  });

  const result = await signInWithCredential(auth, oauthCredential);
  return result.user;
}
