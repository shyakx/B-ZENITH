const { spawnSync } = require("child_process");
const { config } = require("dotenv");

config({ path: ".env.vercel.production", override: true });

const sourceKey = process.env.PROD_DB_KEY || "DATABASE_URL_UNPOOLED";
const raw = process.env[sourceKey];
if (!raw) {
  console.error("Missing " + sourceKey + " in pulled production env.");
  process.exit(1);
}

const url = new URL(raw.replace(/^"|"$/g, ""));
if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
  console.error("Refusing to use a local DATABASE_URL against production.");
  process.exit(2);
}

process.env.DATABASE_URL = url.toString();
console.log("Using production host " + url.hostname);

const args = process.argv.slice(2);
if (args.length === 0) {
  process.exit(0);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
