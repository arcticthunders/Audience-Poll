import { NextRequest, NextResponse } from "next/server";
import { createSign } from "node:crypto";

function b64url(value: string | Buffer): string {
  const buf = typeof value === "string" ? Buffer.from(value) : value;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function mintFirebaseCustomToken(clientEmail: string, privateKey: string, uid: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
  }));
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${b64url(sign.sign(privateKey))}`;
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUsername = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const validPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: "Admin credentials not configured." }, { status: 500 });
  }

  if (username?.trim().toLowerCase() !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "");
    const token = mintFirebaseCustomToken(sa.client_email, sa.private_key, "admin");
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Failed to mint custom token:", err);
    return NextResponse.json({ error: "Authentication failed. Try again." }, { status: 500 });
  }
}
