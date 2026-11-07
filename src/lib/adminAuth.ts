// Admin authentication.
//
// The UI gate is a username + password checked against NEXT_PUBLIC_ADMIN_USERNAME
// and NEXT_PUBLIC_ADMIN_PASSWORD in .env.local.
//
// On success the app signs in anonymously with Firebase Auth.  Firestore security
// rules then allow admin writes only when request.auth != null — audience members
// are never signed in, so they cannot write anything except casting a vote even if
// they call Firestore directly from the browser console.

import {
  getAuth,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  Unsubscribe,
} from "firebase/auth";
import { app } from "./firebase";

const ADMIN_USERNAME = (process.env.NEXT_PUBLIC_ADMIN_USERNAME || "").trim().toLowerCase();
const ADMIN_PASSWORD = (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "").trim();

function authInstance() {
  return getAuth(app);
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return { success: false, error: "Admin credentials are not configured for this deployment." };
  }
  if (
    username.trim().toLowerCase() !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    return { success: false, error: "Invalid credentials. Please enter the admin username and password." };
  }
  try {
    await signInAnonymously(authInstance());
    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "";
    if (code === "auth/network-request-failed") {
      return { success: false, error: "Network error. Check your connection and try again." };
    }
    return { success: false, error: "Sign-in failed. Please try again." };
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await signOut(authInstance());
  } catch (err) {
    console.warn("Sign-out failed:", err);
  }
}

// Fires immediately with the current state, then on every change.
// Returns an unsubscribe function — compatible with useEffect return.
export function onAdminAuthChange(callback: (isAdmin: boolean) => void): Unsubscribe {
  return onAuthStateChanged(authInstance(), (user) => {
    callback(user !== null);
  });
}

// Re-checks the admin password before destructive actions.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  return password.trim() === ADMIN_PASSWORD;
}
