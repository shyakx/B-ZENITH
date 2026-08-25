/**
 * Local-only guard for development scripts.
 * Never import this into production runtime paths.
 */
export function assertLocalDatabase(url = process.env.DATABASE_URL ?? "") {
  if (!url) throw new Error("DATABASE_URL is missing.");
  if (!/localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("Refusing to run: this script is local-only and will not use a remote database.");
  }
}
