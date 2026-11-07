import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set.");
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUsername = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const validPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: "Admin credentials not configured." }, { status: 500 });
  }

  if (
    username?.trim().toLowerCase() !== validUsername ||
    password !== validPassword
  ) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  try {
    const app = getAdminApp();
    const customToken = await getAuth(app).createCustomToken("admin");
    return NextResponse.json({ token: customToken });
  } catch (err) {
    console.error("Failed to mint custom token:", err);
    return NextResponse.json({ error: "Authentication failed. Try again." }, { status: 500 });
  }
}
