const PLACEHOLDER_SECRETS = new Set([
  "",
  "replace-with-a-long-random-secret",
  "changeme",
  "secret",
  "BZenith@2026",
]);

export function isWeakNextAuthSecret(secret = process.env.NEXTAUTH_SECRET) {
  if (!secret) return true;
  if (PLACEHOLDER_SECRETS.has(secret)) return true;
  return secret.length < 32;
}

export function isValidProductionNextAuthUrl(url = process.env.NEXTAUTH_URL) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function publicSiteUrl() {
  const raw = process.env.NEXTAUTH_URL;
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Fall through to the local default rather than crashing metadata generation.
    }
  }
  return "http://localhost:3000";
}

export function assertProductionAuthSecret() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (isWeakNextAuthSecret()) {
    throw new Error(
      "NEXTAUTH_SECRET must be a strong random value in production. Set it in the environment; do not use the development placeholder.",
    );
  }
  if (!isValidProductionNextAuthUrl()) {
    throw new Error(
      "NEXTAUTH_URL must be the public https:// URL of the production app, for example https://pos.example.com",
    );
  }
}
