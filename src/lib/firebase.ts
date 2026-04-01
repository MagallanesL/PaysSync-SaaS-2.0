import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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

function getSecondaryApp() {
  if (!secondaryApp) {
    secondaryApp = getApps().some((existingApp) => existingApp.name === "secondary-auth")
      ? getApp("secondary-auth")
      : initializeApp(firebaseConfig, "secondary-auth");
  }
  return secondaryApp;
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

export function getSecondaryAuth() {
  return getAuth(getSecondaryApp());
}

export function getSecondaryDb() {
  return getFirestore(getSecondaryApp());
}
