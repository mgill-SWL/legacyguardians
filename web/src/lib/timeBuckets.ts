const ET_TZ = "America/New_York";

export function etDayKey(d: Date): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function dayKeyToNoonUTC(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
