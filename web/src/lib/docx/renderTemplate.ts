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
function isTruthyTemplateValue(v: unknown) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return true;
  return Boolean(v);
}

function sanitizeWordXml(xml: string, data: Record<string, unknown>) {
  let out = xml;

  // Word may inject spellcheck/proofing markers that can split template tags.
  // Those markers are safe to remove for our purposes.
  out = out.replace(/<w:proofErr[^>]*\/>/g, "");

  // NotaryRegistrationNumber is currently not collected in IntakeV1.
  // Older templates sometimes include it as raw text or as a bracket placeholder.
  // Instead of trying to coerce it into a token (which can create broken [[ ]] delimiters when
  // Word splits runs), we remove the placeholder so it can't leak into output.
  out = out.replace(/NotaryRegistrationNumber/g, "");

  // Also remove the literal opening bracket that appears in some templates as:
  //   "Notary registration number: ["
  out = out.replace(/Notary registration number:\s*\[/g, "Notary registration number: ");

  // Remove standalone square-bracket runs (common around legacy placeholders like [TOKEN]).
  // These can accidentally create stray "[" or "]" adjacent to our delimiters and break parsing.
  out = out.replace(/<w:t([^>]*)>\s*\[\s*<\/w:t>/g, "<w:t$1></w:t>");
  out = out.replace(/<w:t([^>]*)>\s*\]\s*<\/w:t>/g, "<w:t$1></w:t>");

  // A few templates embed human instructions in brackets.
  out = out.replace(
    /\[signature\s*\u2013\s*please print name under this line\]/gi,
    ""
  );

  // Legacy individual template uses these shorter bracket instructions.
  out = out.replace(/\[\s*signature\s*\]/gi, "");
  out = out.replace(/\[\s*please\s*print\s*name\s*\]/gi, "");

  // Convert simple Jinja value expressions into our [[Token]] delimiters.
  // This is critical for headers/footers that were authored as e.g. "Will of {{Client1FullName}}".
  // We only support the simplest forms and ignore filters.
  out = out.replace(
    /\{\{\s*([A-Za-z0-9_\/]+)(?:\s*\|[^}]*)?\s*\}\}/g,
    "[[$1]]"
  );

  // Convert known legacy dotted-path Jinja expressions into our token names.
  // (Individual template in particular contains these.)
  out = out.replace(
    /\{\{\s*appointments\.trustees\[0\]\.alternate1\.name\s*\}\}/g,
    "[[FIRSTALTERNATETRUSTEEFULLNAME]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.trustees\[0\]\.alternate2\.name\s*\}\}/g,
    "[[SECONDALTERNATETRUSTEEFULLNAME]]"
  );

  out = out.replace(
    /\{\{\s*clients\[0\]\.address\.zip\s*\}\}/g,
    "[[Zip]]"
  );

  // Guardians (individual template)
  out = out.replace(
    /\{\{\s*appointments\.guardian\[0\]\.primary\.name\s*\}\}/g,
    "[[PRIMARYGUARDIANFULLNAME]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.guardian\[1\]\.primary\.relationship\s*\}\}/g,
    "[[PRIMARYGUARDIANRELATIONSHIP]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.guardian\[0\]\.alternate1\.name\s*\}\}/g,
    "[[FIRSTALTERNATEGUARDIANFULLNAME]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.guardian\[1\]\.alternate1\.relationship\s*\}\}/g,
    "[[FIRSTALTERNATEGUARDIANRELATIONSHIP]]"
  );

  // Fix legacy hybrid prefix "[[firstalternateguardianrelationshiptospouse1]/..." by stripping the prefix.
  // After we convert the Jinja fragments above into real tokens, leaving the "/" would break docxtemplater.
  out = out.replace(
    /\[\[(first|second)alternateguardianrelationshiptospouse(1|2)\]\]\s*\//g,
    ""
  );
  out = out.replace(
    /\[\[(first|second)alternateguardianrelationshiptospouse(1|2)\]\//g,
    ""
  );

  // Fix common "unclosed token" mistakes like "[[TOKEN]," or "[[TOKEN]," (note the single closing bracket)
  // where the closing "]]" is missing. This comes up in notary blocks and other legacy sections.
  out = out.replace(/\[\[([A-Za-z0-9_\/]+)\],/g, "[[$1]],");
  out = out.replace(/\[\[([A-Za-z0-9_\/]+),/g, "[[$1]],");

  // Fix hybrid legacy placeholders like:
  //   [[token]/{{ ... }}
  // by stripping the Jinja fragment and keeping the token.
  out = out.replace(/\[\[([A-Za-z0-9_\/]+)\]\/\{\{[\s\S]*?\}\}/g, "[[$1]]");
  out = out.replace(/\[\[([A-Za-z0-9_\/]+)\/\{\{[\s\S]*?\}\}/g, "[[$1]]");

  // Best-effort handling of simple Jinja conditionals so we don't render “skeleton” clauses.
  // Supports:
  //   {% if TOKEN %}...{% endif %}
  //   {% if not TOKEN %}...{% endif %}
  out = out.replace(
    /\{%\s*if\s+(not\s+)?([A-Za-z0-9_\/]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
    (_m, notWord, token, inner) => {
      const truthy = isTruthyTemplateValue(data?.[token]);
      const keep = notWord ? !truthy : truthy;
      return keep ? inner : "";
    }
  );

  // Joint Trust template: suppress the second child slot when CHILD2 is blank.
  // Template contains:
  //   ... [[CHILD1FULLNAME]], born [[CHILD1DOB]]; [[CHILD2FULLNAME]], born [[CHILD2DOB]].
  // Without a second child, it turns into "; , born .".
  if (!isTruthyTemplateValue(data?.CHILD2FULLNAME)) {
    out = out.replace(/;\s*\[\[CHILD2FULLNAME\]\],\s*born\s*\[\[CHILD2DOB\]\]/g, "");
  }

  // Joint Trust template: suppress second alternate guardian/agent slots when blank.
  // Used in the embedded minor-children POA / health-care sections.
  if (!isTruthyTemplateValue(data?.SECONDALTERNATEGUARDIANFULLNAME)) {
    out = out.replace(/\s+and\s+our\s*\[\[SECONDALTERNATEGUARDIANFULLNAME\]\],/g, "");
  }

  // Joint Trust template: successor trustee name is missing in some source docs (or gets split into
  // bracket fragments), producing "succeeded by as the successor Trustee".
  // Force-inject the alternate/successor trustee name token when the slot is blank.
  out = out.replace(
    /succeeded by\s+as the successor Trustee/g,
    "succeeded by [[FIRSTALTERNATETRUSTEEFULLNAME]] as the successor Trustee"
  );

  // Strip any remaining Jinja-style control tags that could show up as "random code".
  // Examples: {% for ... %}, {% endif %}, etc.
  out = out.replace(/\{%[^%]*%\}/g, "");

  // Strip any remaining Jinja variable blocks we didn't convert.
  // These often contain dotted paths or function calls we don't support.
  out = out.replace(/\{\{[\s\S]*?\}\}/g, "");

  // Some templates still have a hardcoded year.
  const year = String(new Date().getFullYear());
  out = out.replace(/2022/g, year);

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

  // Sanitize Word XML parts in-place.
  // NOTE: we sanitize more than just document.xml because headers/footers are a common source of
  // leftover hardcoded years / Jinja tokens.
  const xmlParts = Object.keys(zip.files).filter((name) => {
    if (!name.startsWith("word/")) return false;
    if (!name.endsWith(".xml")) return false;
    // Avoid huge embedded binaries (media lives under word/media and isn't .xml anyway).
    return true;
  });

  for (const name of xmlParts) {
    const f = zip.file(name);
    if (!f) continue;
    const xml = f.asText();
    const sanitized = sanitizeWordXml(xml, data);
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
