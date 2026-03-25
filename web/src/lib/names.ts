export function surnameFromFullName(fullName: string): string {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const parts = cleaned.split(" ");
  return parts[parts.length - 1] ?? "";
}

export function defaultTrustNameFromClient1(fullName: string): string {
  const surname = surnameFromFullName(fullName);
  return surname ? `THE ${surname.toUpperCase()} LIVING TRUST` : "THE LIVING TRUST";
}
