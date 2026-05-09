#!/usr/bin/env node
/**
 * One-off patch to clean up templates/canonical/joint.docx placeholders that were left as blanks.
 *
 * This keeps edits auditable/repeatable vs manual Word editing.
 */

import fs from "node:fs";

import PizZip from "pizzip";

const TEMPLATE_REL = "../templates/canonical/joint.docx";

function main() {
  const buf = fs.readFileSync(TEMPLATE_REL);
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("word/document.xml not found");

  const xml = f.asText();
  let out = xml;

  // Minor children POA co-attorneys-in-fact
  out = out.replace(
    /(do hereby appoint our)\s+and our\s+,/g,
    "$1 [[FIRSTALTERNATEGUARDIANFULLNAME]] and our [[SECONDALTERNATEGUARDIANFULLNAME]],"
  );

  // Minor children health care agents
  out = out.replace(
    /(do hereby designate our)\s+and our\s+,/g,
    "$1 [[FIRSTALTERNATEGUARDIANFULLNAME]] and our [[SECONDALTERNATEGUARDIANFULLNAME]],"
  );

  if (out === xml) {
    console.log("No changes made (pattern not found). Exiting.");
    return;
  }

  zip.file("word/document.xml", out);
  const patched = zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  fs.writeFileSync(TEMPLATE_REL, patched);
  console.log("Patched templates/canonical/joint.docx successfully.");
}

main();

