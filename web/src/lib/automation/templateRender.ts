export function renderTemplate(text: string, vars: Record<string, string | null | undefined>) {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    const value = v ?? "";
    out = out.replaceAll(`{{${k}}}`, value);
  }
  return out;
}

