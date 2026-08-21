/**
 * Manual PostgreSQL dump. Never infers the target.
 *
 * Usage:
 *   node scripts/backup-postgres.js --url-env=DATABASE_URL_UNPOOLED --confirm-host=<exact-hostname> --out=backups/bzenith.dump
 *
 * Refuses pooled hosts, refuses localhost unless --allow-local, and refuses to run
 * unless --confirm-host matches the URL hostname exactly.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { config } = require("dotenv");

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.replace(/^--/, "").split("=");
  args.set(key, value ?? "true");
}

const envFile = args.get("env-file") || ".env";
config({ path: path.resolve(envFile) });

const urlEnv = args.get("url-env") || "DATABASE_URL_UNPOOLED";
const confirmHost = args.get("confirm-host");
const out = args.get("out");
const allowLocal = args.get("allow-local") === "true";

if (!confirmHost || !out) {
  console.error("Required: --confirm-host=<hostname> --out=<file>");
  process.exit(1);
}

const raw = process.env[urlEnv];
if (!raw) {
  console.error("Missing " + urlEnv + " in " + envFile);
  process.exit(1);
}

const url = new URL(raw.replace(/^"|"$/g, ""));
console.log("DATABASE TARGET: " + url.hostname + "/" + url.pathname.replace(/^\//, ""));
console.log("OPERATION: pg_dump custom format to " + out);

if (url.hostname.includes("-pooler")) {
  console.error("Refusing pooled hostname. Use the direct/unpooled connection.");
  process.exit(2);
}
if (!allowLocal && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
  console.error("Refusing local database. Pass --allow-local=true only for a disposable local copy.");
  process.exit(2);
}
if (url.hostname !== confirmHost) {
  console.error("Hostname mismatch. Expected --confirm-host=" + confirmHost);
  process.exit(2);
}

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const result = spawnSync(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-acl", "--file", out, url.toString()],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
