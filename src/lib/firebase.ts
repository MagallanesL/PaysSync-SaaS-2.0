import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
let secondaryApp: FirebaseApp | null = null;
let emulatorsConnected = false;
const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

function parseHostPort(hostPort: string | undefined, fallbackHost: string, fallbackPort: number) {
  const [host = fallbackHost, port = String(fallbackPort)] = hostPort?.split(":") ?? [];
  return {
    host,
    port: Number(port)
  };
}

function connectAppEmulators(targetApp: FirebaseApp) {
  const authInstance = getAuth(targetApp);
  const firestoreInstance = getFirestore(targetApp);
  const functionsInstance = getFunctions(targetApp, "us-central1");
  const authTarget = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const firestoreTarget = parseHostPort(
    import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST,
    "127.0.0.1",
    8080
  );
  const functionsTarget = parseHostPort(
    import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST,
    "127.0.0.1",
    5001
  );

  connectAuthEmulator(authInstance, `http://${authTarget}`, { disableWarnings: true });
  connectFirestoreEmulator(firestoreInstance, firestoreTarget.host, firestoreTarget.port);
  connectFunctionsEmulator(functionsInstance, functionsTarget.host, functionsTarget.port);
}

function getSecondaryApp() {
  if (!secondaryApp) {
    secondaryApp = getApps().some((existingApp) => existingApp.name === "secondary-auth")
      ? getApp("secondary-auth")
      : initializeApp(firebaseConfig, "secondary-auth");
    if (useFirebaseEmulators) {
      connectAppEmulators(secondaryApp);
    }
  }
  return secondaryApp;
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

if (useFirebaseEmulators && !emulatorsConnected) {
  connectAppEmulators(app);
  emulatorsConnected = true;
}

export function getSecondaryAuth() {
  return getAuth(getSecondaryApp());
}

export function getSecondaryDb() {
  return getFirestore(getSecondaryApp());
}
