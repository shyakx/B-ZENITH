const fs = require("node:fs");
const path = require("node:path");

function shape(file) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return { file, exists: false };
  const keys = {};
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    const row = { set: true, length: v.length };
    if (k.includes("URL") || k.includes("DATABASE")) {
      try {
        const u = new URL(v);
        row.protocol = u.protocol;
        row.hostname = u.hostname;
        row.isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
        row.hasPooler = u.hostname.includes("-pooler");
        row.isHttps = u.protocol === "https:";
      } catch {
        row.validUrl = false;
      }
    }
    if (k === "NEXTAUTH_SECRET") {
      row.weakLength = v.length < 32;
      row.placeholder = ["replace-with-a-long-random-secret", "changeme", "secret", "BZenith@2026"].includes(v);
    }
    keys[k] = row;
  }
  return { file, exists: true, keys };
}

for (const file of [".env", ".env.vercel.production"]) {
  console.log(JSON.stringify(shape(file), null, 2));
}
