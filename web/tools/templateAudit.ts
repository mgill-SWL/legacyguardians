#!/usr/bin/env node
/**
 * Template audit helper: renders a DOCX template with sample intake data and reports:
 *  - missing tokens (as detected by docxtemplater nullGetter)
 *  - common "leftovers" that indicate template hygiene issues
 */

import fs from "node:fs";
import path from "node:path";

import PizZip from "pizzip";

import { renderDocxTemplate, repoTemplatePath } from "../src/lib/docx/renderTemplate";
import { tokenDataFromIntake } from "../src/lib/tokenMap";
import { sampleIntake } from "./sampleIntake";

function usage() {
  console.log("Usage: npx tsx tools/templateAudit.ts <templateRelFromRepoRoot>");
  console.log("Example: npx tsx tools/templateAudit.ts templates/canonical/joint.docx");
}

function openDocx(buf: Buffer) {
  const zip = new PizZip(buf);
  const get = (p: string) => zip.file(p)?.asText() ?? "";
  return {
    documentXml: get("word/document.xml"),
    headers: Object.keys(zip.files)
      .filter((k) => k.startsWith("word/header") && k.endsWith(".xml"))
      .map((k) => get(k))
      .join("\n\n"),
    footers: Object.keys(zip.files)
      .filter((k) => k.startsWith("word/footer") && k.endsWith(".xml"))
      .map((k) => get(k))
      .join("\n\n"),
  };
}

function checkLeftovers(text: string) {
  const findings: string[] = [];
  const checks: Array<[string, RegExp]> = [
    ["hardcoded 2022", /2022/],
    ["jinja var left", /\{\{[^}]+\}\}/],
    ["jinja tag left", /\{%[^%]*%\}/],
    ["docxtemplater delimiter left", /\[\[[A-Za-z0-9_\/]+\]\]/],
    ["NotaryRegistrationNumber left", /NotaryRegistrationNumber/],
    ["bracket placeholder left", /\[[A-Za-z0-9_\/]+\]/],
    ["double spaces", /\s{3,}/],
    ["succeeded by as the successor Trustee", /succeeded by\s+as the successor Trustee/],
  ];
  for (const [label, re] of checks) {
    if (re.test(text)) findings.push(label);
  }
  return findings;
}

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    usage();
    process.exit(1);
  }

  const abs = repoTemplatePath(rel);
  if (!fs.existsSync(abs)) {
    console.error(`Template not found: ${abs}`);
    process.exit(1);
  }

  const intake = sampleIntake();
  const data = tokenDataFromIntake(intake);

  const { buffer, missingTokens } = renderDocxTemplate({ templateAbsPath: abs, data });
  const out = openDocx(buffer);

  const leftovers = checkLeftovers([out.documentXml, out.headers, out.footers].join("\n\n"));

  console.log(JSON.stringify({
    template: rel,
    abs,
    missingTokens,
    leftovers,
  }, null, 2));

  // Save rendered output next to template for manual spot-check.
  const outDir = path.resolve(process.cwd(), "tools", ".audit-out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, path.basename(rel));
  fs.writeFileSync(outPath, buffer);
  console.log(`\nRendered output saved to: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

