import admin from "firebase-admin";

let app: admin.app.App | null = null;

/**
 * Returns the singleton Firebase Admin app.
 *
 * Initialization strategy (in order):
 *  1. FIREBASE_SERVICE_ACCOUNT env var — JSON string of a service account key.
 *     Set this in Secret Manager for Cloud Run.
 *  2. Application Default Credentials — works automatically on Cloud Run
 *     when the service account has been granted the necessary IAM roles.
 *     Also works locally when `gcloud auth application-default login` has been run.
 */
export function getAdminApp(): admin.app.App {
  if (app) return app;

  if (admin.apps.length > 0) {
    app = admin.app();
    return app;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Application Default Credentials — Cloud Run picks this up automatically.
    // Locally: run `gcloud auth application-default login` or point
    // GOOGLE_APPLICATION_CREDENTIALS to a downloaded service account JSON file.
    app = admin.initializeApp();
  }

  return app;
}

/** Shorthand for token verification — the only Admin Auth operation we use. */
export function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  return getAdminApp().auth().verifyIdToken(token);
}
