import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "@/lib/auth/roles";

export const SESSION_COOKIE = "bzenith_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

export const SESSION_COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    ...SESSION_COOKIE_BASE,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function expireSessionCookie(store: {
  set: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => unknown;
  delete?: (name: string) => unknown;
}) {
  store.delete?.(SESSION_COOKIE);
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export type SessionPayload = {
  userId: string;
  name: string;
  role: Role;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      !isRole(payload.role)
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
