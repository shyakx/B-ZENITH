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

export function assertProductionAuthSecret() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!isWeakNextAuthSecret()) return;
  throw new Error(
    "NEXTAUTH_SECRET must be a strong random value in production. Set it in the environment; do not use the development placeholder.",
  );
}
