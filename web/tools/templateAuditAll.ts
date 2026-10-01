#!/usr/bin/env node
/**
 * CI gate: renders every canonical template the matter packet uses with the
 * sample intake and fails (exit 1) when a document would contain missing
 * tokens or serious leftovers (unconverted placeholders, the
 * "succeeded by as the successor Trustee" bug, hardcoded 2022).
 *
 * Cosmetic findings ("double spaces") are reported as warnings only.
 *
 * Run: npx tsx tools/templateAuditAll.ts
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import PizZip from "pizzip";

import { renderDocxTemplate, repoTemplatePath } from "../src/lib/docx/renderTemplate";
import { tokenDataFromIntakeWithOptions } from "../src/lib/tokenMap";
import { sampleIntake } from "./sampleIntake";

// Templates the packet/RA flows actually render. reciprocal.docx is the
// legacy Jinja-style source and is intentionally excluded (the reciprocal
// offering renders individual.docx).
const TEMPLATES = [
  "templates/canonical/joint.docx",
  "templates/canonical/individual.docx",
  "templates/canonical/packet_split/will_client1.docx",
  "templates/canonical/packet_split/will_client2.docx",
  "templates/canonical/packet_split/advance_medical_directive_client1.docx",
  "templates/canonical/packet_split/advance_medical_directive_client2.docx",
  "templates/canonical/packet_split/final_disposition_client1.docx",
  "templates/canonical/packet_split/final_disposition_client2.docx",
  "templates/canonical/packet_split/minor_children_poa_and_healthcare.docx",
  "templates/canonical/packet_split/certification_of_trust.docx",
  "templates/canonical/packet_split/assignment_of_personal_property.docx",
  "templates/canonical/packet_split/declaration_of_trust.docx",
  "templates/canonical/packet_split/durable_poa_client1.docx",
  "templates/canonical/packet_split/durable_poa_client2.docx",
];

const WARN_ONLY_LEFTOVERS = new Set(["double spaces"]);

type AuditResult = {
  template: string;
  missingTokens: string[];
  leftovers: string[];
};

function runAudit(template: string): AuditResult {
  const stdout = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", path.join("tools", "templateAudit.ts"), template],
    { encoding: "utf8", shell: process.platform === "win32" }
  );
  const jsonStart = stdout.indexOf("{");
  const jsonEnd = stdout.lastIndexOf("}");
  const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as AuditResult;
  return parsed;
}

let failures = 0;

for (const template of TEMPLATES) {
  const abs = path.resolve(process.cwd(), "..", template);
  if (!fs.existsSync(abs)) {
    console.error(`FAIL ${template}: template file not found`);
    failures += 1;
    continue;
  }

  let result: AuditResult;
  try {
    result = runAudit(template);
  } catch (e) {
    console.error(`FAIL ${template}: render error`);
    console.error(e instanceof Error ? e.message : String(e));
    failures += 1;
    continue;
  }

  const seriousLeftovers = result.leftovers.filter((l) => !WARN_ONLY_LEFTOVERS.has(l));
  const warnings = result.leftovers.filter((l) => WARN_ONLY_LEFTOVERS.has(l));

  if (result.missingTokens.length > 0 || seriousLeftovers.length > 0) {
    failures += 1;
    console.error(`FAIL ${template}`);
    if (result.missingTokens.length) console.error(`  missing tokens: ${result.missingTokens.join(", ")}`);
    if (seriousLeftovers.length) console.error(`  leftovers: ${seriousLeftovers.join(", ")}`);
  } else {
    console.log(`PASS ${template}${warnings.length ? ` (warnings: ${warnings.join(", ")})` : ""}`);
  }
}

// Reciprocal distribution is produced by the [[#reciprocal]] / [[^reciprocal]]
// conditionals in individual.docx (not by runtime XML surgery). Render both
// spouse POVs and assert the two-branch structure appears with no missing
// tokens — this is the coverage the old surgery never had (it had silently
// stopped firing).
{
  const base = sampleIntake();
  const abs = repoTemplatePath("templates/canonical/individual.docx");
  for (const pov of [1, 2] as const) {
    const data = {
      ...(tokenDataFromIntakeWithOptions(
        { ...base, offering: "RECIPROCAL_TRUSTS" },
        { primaryClient: pov, reciprocalTrustView: true },
      ) as Record<string, unknown>),
      Offering: "RECIPROCAL_TRUSTS",
    };
    const { buffer, missingTokens } = renderDocxTemplate({ templateAbsPath: abs, data });
    const text = (new PizZip(buffer).file("word/document.xml")?.asText() ?? "").replace(/<[^>]+>/g, "");
    const problems: string[] = [];
    if (missingTokens.length) problems.push(`missing tokens: ${missingTokens.join(", ")}`);
    if (!text.includes("Distribution at My Death if My Spouse Survives")) {
      problems.push("missing 'spouse survives' branch");
    }
    if (!text.includes("Distribution at My Death if My Spouse Predeceases Me")) {
      problems.push("missing 'spouse predeceases' branch");
    }
    if (problems.length) {
      failures += 1;
      console.error(`FAIL reciprocal individual.docx (spouse ${pov}): ${problems.join("; ")}`);
    } else {
      console.log(`PASS reciprocal individual.docx (spouse ${pov})`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} template(s) failed the audit.`);
  process.exit(1);
}
console.log("\nAll templates passed.");
