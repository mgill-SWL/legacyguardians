export function pad4(n: number) {
  return String(n).padStart(4, "0");
}

export function invoiceNumber(opts: { firmSlug: string; year: number; seq: number }) {
  const slug = opts.firmSlug.trim().toUpperCase();
  return `${slug}-${opts.year}-${pad4(opts.seq)}`;
}

