import fs from "node:fs";

const envPath = new URL("../.env", import.meta.url);
const env = fs.readFileSync(envPath, "utf8");
const line = env.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
if (!line) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

let raw = line.slice("DATABASE_URL=".length).trim();
if (
  (raw.startsWith('"') && raw.endsWith('"')) ||
  (raw.startsWith("'") && raw.endsWith("'"))
) {
  raw = raw.slice(1, -1);
}

const url = new URL(raw);
const host = url.hostname;
const port = url.port || "(default)";
const database = url.pathname.replace(/^\//, "").split("?")[0];
const local = host === "localhost" || host === "127.0.0.1";
const neon = /neon\.tech/i.test(host) || /neon\.tech/i.test(raw);

console.log("DATABASE TARGET:");
console.log("HOST:", host);
console.log("PORT:", port);
console.log("DATABASE:", database);
console.log("LOCAL:", local ? "YES" : "NO");
console.log("NEON_OR_REMOTE:", neon || !local ? "YES" : "NO");

if (!local || neon) {
  process.exit(2);
}
