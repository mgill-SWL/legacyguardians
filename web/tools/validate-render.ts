import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { renderDocxTemplate, repoTemplatePath } from "../src/lib/docx/renderTemplate";
import { tokenDataFromIntakeWithOptions } from "../src/lib/tokenMap";
import type { IntakeV1 } from "../src/lib/intakeTypes";

function sh(cmd: string) {
  return execSync(cmd, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 }).toString("utf8");
}

function validateDocx(file: string) {
  // Basic zip integrity.
  sh(`unzip -t ${JSON.stringify(file)}`);

  const list = sh(`unzip -Z1 ${JSON.stringify(file)}`)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => n.startsWith("word/") && n.endsWith(".xml"));

  for (const name of list) {
    const xml = sh(`unzip -p ${JSON.stringify(file)} ${JSON.stringify(name)}`);
    // xmllint exits non-zero on invalid XML.
    try {
      execSync("xmllint --noout -", { input: xml, maxBuffer: 50 * 1024 * 1024 });
    } catch (e) {
      throw new Error(`Invalid XML in ${path.basename(file)} :: ${name}`);
    }
  }
}

const intake: IntakeV1 = {
  offering: "RECIPROCAL_TRUSTS",
  grantors: ["John Doe", "Jane Doe"],
  hasMinorChildren: false,
  clientAddress: { street: "1 Main St", city: "Alexandria", state: "VA", zip: "22314" },
  clientEmails: {},
  clientPhones: {},
  trustNameOverridesByClient: {
    client1: "THE JOHN DOE FAMILY LIVING TRUST",
    client2: "THE JANE DOE FAMILY LIVING TRUST",
  },
  people: [{ id: "p1", name: "John Doe" }],
  roles: {
    trustees: { client1: {}, client2: {} },
    executors: { client1: {}, client2: {} },
    financialAgents: { client1: {}, client2: {} },
    healthAgents: { client1: {}, client2: {} },
    guardians: {},
    finalDispositionAgents: { client1: [[]], client2: [[]] },
  },
  children: [],
  successorTrustees: [],
  distributionScheme: "standard-per-stirpes-ni21-row-25-30-halves",
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lg-docx-"));

const tmpl = repoTemplatePath("templates/canonical/individual.docx");

for (const pov of [1, 2] as const) {
  const data = tokenDataFromIntakeWithOptions(intake, { primaryClient: pov });
  const out = renderDocxTemplate({ templateAbsPath: tmpl, data });
  const outPath = path.join(tmpDir, `individual_pov${pov}.docx`);
  fs.writeFileSync(outPath, out.buffer);
  validateDocx(outPath);
  // eslint-disable-next-line no-console
  console.log("OK", outPath, "missingTokens", out.missingTokens.length);
}

// eslint-disable-next-line no-console
console.log("All good.");
