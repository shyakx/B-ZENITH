/**
 * Neon’s pooler (PgBouncer) cannot keep Prisma interactive transactions
 * (row locks for receive / transfer / POS). Prefer DIRECT_URL, otherwise
 * rewrite a Neon *-pooler.* host to the compute endpoint.
 */
export function prismaConnectionUrl(databaseUrl?: string, directUrl?: string) {
  const direct = directUrl?.trim();
  if (direct) return direct;

  const url = databaseUrl?.trim() ?? "";
  if (!url) return url;

  try {
    const parsed = new URL(url);
    if (/\.neon\.tech$/i.test(parsed.hostname) && parsed.hostname.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
      return parsed.toString();
    }
  } catch {
    return url.replace("-pooler.", ".");
  }

  return url;
}
