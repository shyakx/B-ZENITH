export type CatalogNameMatchKind = "exact" | "near";

export type CatalogNameMatch<T extends { id: string; name: string } = { id: string; name: string }> = T & {
  kind: CatalogNameMatchKind;
};

/** Comparison-only normalization. Does not change stored names. */
export function normalizeCatalogName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, prevDiag + cost);
      prevDiag = temp;
    }
  }
  return prev[b.length]!;
}

function numberTokens(normalized: string): string {
  return (normalized.match(/\d+/g) ?? []).join("|");
}

/** Longer name is the shorter name plus extra words (Chicken vs Chicken Wings). */
function isNameExtension(shorter: string, longer: string): boolean {
  return longer.startsWith(`${shorter} `) && longer.length > shorter.length + 1;
}

/**
 * Returns how closely two catalog names match for duplicate warnings.
 * Conservative: size variants and "base + extra words" stay separate.
 */
export function catalogNameSimilarity(input: string, existing: string): CatalogNameMatchKind | null {
  const a = normalizeCatalogName(input);
  const b = normalizeCatalogName(existing);
  if (!a || !b) return null;
  if (a === b) return "exact";

  const numsA = numberTokens(a);
  const numsB = numberTokens(b);
  if (numsA && numsB && numsA !== numsB) return null;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // "Chicken" vs "Chicken Wings" — longer name is the shorter name plus more words.
  if (isNameExtension(short, long)) return null;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const lenDiff = Math.abs(a.length - b.length);

  if (dist === 1) return "near";
  if (maxLen >= 6 && maxLen <= 16 && dist === 2 && lenDiff <= 2) return "near";

  // "Beer" vs "Beers & Drinks": short form vs plural/near primary word + extra words.
  // Exact primary + extra words is already excluded by isNameExtension.
  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  if (tokensA.length === 1 || tokensB.length === 1) {
    const primaryA = tokensA[0]!;
    const primaryB = tokensB[0]!;
    const primaryDist = levenshtein(primaryA, primaryB);
    const primaryMax = Math.max(primaryA.length, primaryB.length);
    if (primaryDist === 1 && primaryMax >= 3) return "near";
  }

  return null;
}

export function findSimilarCatalogNames<T extends { id: string; name: string }>(
  input: string,
  candidates: T[],
  options?: { excludeId?: string; limit?: number },
): CatalogNameMatch<T>[] {
  const excludeId = options?.excludeId;
  const limit = options?.limit ?? 5;
  const matches: CatalogNameMatch<T>[] = [];

  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue;
    const kind = catalogNameSimilarity(input, candidate.name);
    if (!kind) continue;
    matches.push({ ...candidate, kind });
  }

  matches.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "exact" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  return matches.slice(0, limit);
}
