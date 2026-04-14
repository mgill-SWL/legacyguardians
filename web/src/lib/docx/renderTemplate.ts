import fs from "node:fs";
import path from "node:path";

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type RenderDocxResult = {
  buffer: Buffer;
  missingTokens: string[];
};

/**
 * Render a DOCX template with [[Token]] placeholders using docxtemplater.
 *
 * We use custom delimiters [[ ]], to match existing template tokens.
 */
function sanitizeWordXml(xml: string) {
  // Strip Jinja-style control tags that show up as "random code" in output.
  // We are *not* using Jinja at render time, so these should never be visible.
  // Examples: {% if ... %}, {% for ... %}, {% endif %}, etc.
  let out = xml.replace(/\{%[^%]*%\}/g, "");

  // Strip any leftover Jinja-style value expressions, if present.
  out = out.replace(/\{\{[^}]*\}\}/g, "");

  return out;
}

export function renderDocxTemplate({
  templateAbsPath,
  data,
}: {
  templateAbsPath: string;
  data: Record<string, unknown>;
}): RenderDocxResult {
  const content = fs.readFileSync(templateAbsPath, "binary");
  const zip = new PizZip(content);

  // Sanitize the relevant Word XML parts in-place.
  const xmlParts = Object.keys(zip.files).filter(
    (name) =>
      name === "word/document.xml" ||
      /^word\/header\d+\.xml$/.test(name) ||
      /^word\/footer\d+\.xml$/.test(name)
  );

  for (const name of xmlParts) {
    const f = zip.file(name);
    if (!f) continue;
    const xml = f.asText();
    const sanitized = sanitizeWordXml(xml);
    if (sanitized !== xml) zip.file(name, sanitized);
  }

  const missingTokens = new Set<string>();

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "[[", end: "]]" },
    nullGetter(part) {
      // docxtemplater calls this for missing properties.
      if (typeof part?.value === "string") missingTokens.add(part.value);
      return "";
    },
  });

  doc.render(data);

  const out = doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;

  return { buffer: out, missingTokens: [...missingTokens].sort() };
}

export function repoTemplatePath(relFromRepoRoot: string) {
  // In Vercel, process.cwd() should be the web root (Root Directory = web)
  // Repo root is one level up.
  return path.resolve(process.cwd(), "..", relFromRepoRoot);
}
