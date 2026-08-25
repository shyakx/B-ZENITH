import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import { assertLocalDatabase } from "./assert-local-database";

const envFile = parse(readFileSync(".env"));
const url = envFile.DATABASE_URL ?? "";
assertLocalDatabase(url);
const parsed = new URL(url.replace(/^postgresql:/, "http:"));
console.log(`migrating ${parsed.hostname}:${parsed.port}${parsed.pathname}`);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
