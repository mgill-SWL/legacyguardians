import { createHash } from "node:crypto";

/**
 * Stable per-row dedupe hashes for journal imports.
 *
 * Each row's hash is derived from its content fields, plus an occurrence
 * counter so two legitimately identical rows within one file get distinct
 * hashes (both import), while re-uploading the same file reproduces the same
 * hashes and every row is skipped.
 */
export function dedupeHashesForRows(rows: string[][]): string[] {
  const counts = new Map<string, number>();
  return rows.map((parts) => {
    const base = parts.join("|");
    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);
    return createHash("sha256").update(`${base}|#${occurrence}`).digest("hex");
  });
}
