import {
  getAuth,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  Unsubscribe,
} from "firebase/auth";
import { app } from "./firebase";

function authInstance() {
  return getAuth(app);
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    let data: { token?: string; error?: string } = {};
    try {
      data = await res.json();
    } catch {
      return { success: false, error: `Server error (${res.status}). Check deployment logs.` };
    }

    if (!res.ok) {
      return { success: false, error: data.error || "Invalid credentials." };
    }

    try {
      await signInWithCustomToken(authInstance(), data.token!);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      return { success: false, error: `Firebase sign-in failed: ${code || String(err)}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Admin login error:", err);
    return { success: false, error: `Network error: ${String(err)}` };
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

