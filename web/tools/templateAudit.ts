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
import type { IntakeV1 } from "../src/lib/intakeTypes";

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

function sampleIntake(): IntakeV1 {
  return {
    offering: "JOINT_TRUST",
    matterType: "JOINT_TRUST",
    grantors: ["Alexandra M. Doe", "Benjamin R. Doe"],
    hasMinorChildren: true,
    clientAddress: {
      street: "123 Main St",
      city: "Fairfax",
      state: "VA",
      zip: "22030",
    },
    clientEmails: { client1: "alex@example.com", client2: "ben@example.com" },
    clientPhones: { client1: "+17035550100", client2: "+17035550101" },
    trustNameOverride: "The Doe Family Trust",
    people: [
      {
        id: "sp1",
        name: "Alexandra M. Doe",
        email: "alex@example.com",
        phone: "+17035550100",
      },
      {
        id: "sp2",
        name: "Benjamin R. Doe",
        email: "ben@example.com",
        phone: "+17035550101",
      },
      {
        id: "p_guard1",
        name: "Jordan Smith",
        relationship: "sister",
        relationshipPhraseToSpouse1: "my sister",
        relationshipPhraseToSpouse2: "my sister-in-law",
        relationshipPhraseJoint: "our sister",
        addressStreet: "1 Oak Ave",
        addressCity: "Arlington",
        addressState: "VA",
        addressZip: "22201",
        email: "jordan@example.com",
        phone: "+17035550111",
      },
      {
        id: "p_guard2",
        name: "Casey Lee",
        relationship: "friend",
        relationshipPhraseToSpouse1: "my friend",
        relationshipPhraseToSpouse2: "my friend",
        relationshipPhraseJoint: "our friend",
        addressStreet: "2 Pine Rd",
        addressCity: "Alexandria",
        addressState: "VA",
        addressZip: "22314",
        email: "casey@example.com",
        phone: "+17035550112",
      },
      {
        id: "p_trustee",
        name: "Taylor Nguyen",
        relationship: "brother",
        relationshipPhraseToSpouse1: "my brother",
        relationshipPhraseToSpouse2: "my brother-in-law",
        relationshipPhraseJoint: "our brother",
        addressStreet: "3 Cedar St",
        addressCity: "Richmond",
        addressState: "VA",
        addressZip: "23220",
        email: "taylor@example.com",
        phone: "+17035550113",
      },
    ],
    roles: {
      trustees: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      executors: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      financialAgents: { primary: "sp1", alternate1: "p_trustee", alternate2: "p_guard2" },
      healthAgents: { primary: "sp1", alternate1: "p_guard1", alternate2: "p_guard2" },
      guardians: { primary: "p_guard1", alternate1: "p_guard2", alternate2: "p_trustee" },
    },
    children: [
      { name: "Charlie Doe", dob: "2017-06-15" },
      { name: "Dakota Doe", dob: "2019-09-02" },
    ],
    successorTrustees: ["Taylor Nguyen"],
    distributionScheme: "standard-per-stirpes-ni21-row-25-30-halves",
    trustProtector: { enabled: true, name: "Morgan Riley" },
  };
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

