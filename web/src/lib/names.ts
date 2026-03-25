export function surnameFromFullName(fullName: string): string {
  // MVP heuristic: last whitespace-delimited token, ignoring common suffixes.
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const rawParts = cleaned.split(" ");
  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
  const parts = rawParts.filter((p) => p && !suffixes.has(p.toLowerCase()));
  return parts[parts.length - 1] ?? rawParts[rawParts.length - 1] ?? "";
}

export function defaultTrustNameFromClient1(fullName: string): string {
  const surname = surnameFromFullName(fullName);
  return surname
    ? `${surname.toUpperCase()} FAMILY LIVING TRUST`
    : "FAMILY LIVING TRUST";
}
