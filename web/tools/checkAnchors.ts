#!/usr/bin/env node
/**
 * Prints the signing anchors found in a PDF — use to verify an exported PDF
 * before sending it for signature.
 *
 * Run: npx tsx tools/checkAnchors.ts "C:\path\to\document.pdf"
 */
import fs from "node:fs";

import { fieldsFromAnchors, findSigningAnchors } from "../src/lib/signing/pdfAnchors";

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("Usage: npx tsx tools/checkAnchors.ts <path-to-pdf>");
    process.exit(1);
  }
  const anchors = await findSigningAnchors(fs.readFileSync(file));
  console.log(`Anchors found: ${anchors.length}`);
  for (const a of anchors) {
    console.log(
      `  ${a.anchor} (signer ${a.signer}, ${a.kind}) page ${a.page} at x=${a.positionX.toFixed(1)}% y=${a.positionY.toFixed(1)}%`
    );
  }
  if (anchors.length) {
    const fields = fieldsFromAnchors(anchors);
    console.log(`Fields that would be placed: ${fields.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
