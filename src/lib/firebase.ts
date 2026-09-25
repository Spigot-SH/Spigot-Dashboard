import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True only when every NEXT_PUBLIC_FIREBASE_* variable is set. There is no baked-in fallback:
 * a misconfigured deploy must hide "Continue with Google" rather than quietly sign users into
 * the wrong Firebase project. Callers must check this before using `auth` or `googleProvider`.
 */
export const firebaseConfigured = Object.values(firebaseConfig).every(
  (value): value is string => typeof value === 'string' && value.length > 0,
);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

if (firebaseConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  authInstance = getAuth(app);
}

/** Undefined when `firebaseConfigured` is false. Never used in that case — the sign-in button is disabled. */
export const auth = authInstance as Auth;
export const googleProvider = new GoogleAuthProvider();
