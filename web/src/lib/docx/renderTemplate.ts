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
export function renderDocxTemplate({
  templateAbsPath,
  data,
}: {
  templateAbsPath: string;
  data: Record<string, unknown>;
}): RenderDocxResult {
  const content = fs.readFileSync(templateAbsPath, "binary");
  const zip = new PizZip(content);

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

  const out = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;

  return { buffer: out, missingTokens: [...missingTokens].sort() };
}

export function repoTemplatePath(relFromRepoRoot: string) {
  // In Vercel, process.cwd() should be the web root (Root Directory = web)
  // Repo root is one level up.
  return path.resolve(process.cwd(), "..", relFromRepoRoot);
}
