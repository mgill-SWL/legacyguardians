#!/usr/bin/env node
/**
 * One-off patch to clean up templates/canonical/reciprocal.docx legacy trustee tokens.
 */

import fs from "node:fs";

import PizZip from "pizzip";

const TEMPLATE_REL = "../templates/canonical/reciprocal.docx";

function main() {
  const buf = fs.readFileSync(TEMPLATE_REL);
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("word/document.xml not found");

  const xml = f.asText();
  let out = xml;

  // Remove accidental leading space inside token name (Word split the token across runs).
  out = out.replace(
    /(<w:t[^>]*xml:space="preserve"[^>]*>)\s+Spouse1SecondAlternateTrusteeRelationship/g,
    "$1Spouse1SecondAlternateTrusteeRelationship"
  );
  out = out.replace(
    /(<w:t[^>]*xml:space="preserve"[^>]*>)\s+SECONDALTERNATETRUSTEERelationship/g,
    "$1SECONDALTERNATETRUSTEERelationship"
  );
  out = out.replace(/\[\[\s+SECONDALTERNATETRUSTEERelationship/g, "[[SECONDALTERNATETRUSTEERelationship");

  // Replace legacy spouse token names with canonical trustee tokens.
  out = out.replace(/Spouse1SecondAlternateTrusteeRelationship/g, "SECONDALTERNATETRUSTEERelationship");
  out = out.replace(/SPOUSE1SECONDALTERNATETRUSTEE/g, "SECONDALTERNATETRUSTEEFULLNAME");

  if (out === xml) {
    console.log("No changes made (patterns not found). Exiting.");
    return;
  }

  zip.file("word/document.xml", out);
  const patched = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(TEMPLATE_REL, patched);
  console.log("Patched templates/canonical/reciprocal.docx successfully.");
}

main();
