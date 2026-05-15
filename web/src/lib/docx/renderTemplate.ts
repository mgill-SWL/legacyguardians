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

  // --- Notary block normalization ("Rewind the Notary") ---
  // Some canonical templates still hardcode a specific notary name.
  // Replace it with our standard token so attorney-user input can control it.
  // (We keep the surrounding ", Notary Public" as literal text.)
  out = out.replace(
    /MICHAEL\s+DOUD\s+GILL\s+III,\s*Notary\s+Public/gi,
    "[[NOTARYNAME]], Notary Public"
  );

  // Convert the notary signature underline (commonly 41 underscores in the golden templates)
  // into a token so we can reliably remove/alter it without fighting Word underline formatting.
  // We scope this to the notary blocks by requiring that NOTARYNAME appears shortly after.
  out = out.replace(
    /(<w:t[^>]*>)_________________________________________(<\/w:t>[\s\S]{0,2000}?\[\[NOTARYNAME)/g,
    "$1[[NOTARYSIGNATURELINE]]$2"
  );

  // Some templates use an underscore fill for the notary commission expiration.
  // Make it a real token so it can be filled (or left blank) intentionally.
  out = out.replace(
    /(My commission expires:\s*)_+/g,
    "$1[[NotaryExpirationDate]]"
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
    /\{\{\s*appointments\.trustees\[0\]\.alternate1\.relationship\s*\}\}/g,
    "[[FIRSTALTERNATETRUSTEERelationship]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.trustees\[0\]\.alternate2\.name\s*\}\}/g,
    "[[SECONDALTERNATETRUSTEEFULLNAME]]"
  );
  out = out.replace(
    /\{\{\s*appointments\.trustees\[0\]\.alternate2\.relationship\s*\}\}/g,
    "[[SECONDALTERNATETRUSTEERelationship]]"
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

  // Reciprocal trust (now rendered using the individual trust template twice):
  // Inject the Paragraph 6.F reciprocal distribution logic:
  //  - Conditional effectiveness (spouse survives)
  //  - Two subparagraphs (TPP + residue to spouse's trust trustee)
  //  - Then the existing distribution-at-death section becomes the "spouse predeceases" branch.
  if (data?.Offering === "RECIPROCAL_TRUSTS") {
    const heading = "Distribution of the Trust Estate at My Death";
    const headingIdx = out.indexOf(heading);
    if (headingIdx !== -1 && out.includes("DECLARATION OF TRUST")) {
      // Locate the heading paragraph (contains the heading text) and capture its structure so
      // inserted paragraphs match numbering/indentation.
      const headingParaStart = out.lastIndexOf("<w:p", headingIdx);
      const findParaEnd = (xml: string, paraStartIdx: number) => {
        // Find the matching </w:p> for the <w:p ...> at paraStartIdx, accounting for
        // nested paragraphs that can appear in Word (e.g., textboxes).
        const tagRe = /<\/?w:p\b[^>]*>/g;
        tagRe.lastIndex = paraStartIdx;
        let depth = 0;
        let m: RegExpExecArray | null;
        while ((m = tagRe.exec(xml))) {
          const tag = m[0];
          const isClose = tag.startsWith("</w:p");
          const isSelfClosing = /\/>$/.test(tag);
          if (!isClose && !isSelfClosing) depth += 1;
          if (isClose) depth -= 1;
          if (depth === 0 && isClose) return tagRe.lastIndex; // index after </w:p>
        }
        return -1;
      };

      const headingParaEnd = headingParaStart === -1 ? -1 : findParaEnd(out, headingParaStart);

      if (headingParaStart !== -1 && headingParaEnd !== -1) {
        const headingParaXml = out.slice(headingParaStart, headingParaEnd);

        // Find the first numbered list paragraph that follows the heading (to clone numbering style).
        // NOTE: the templates sometimes have blank spacing paragraphs immediately after headings.
        // We must *skip* those; otherwise we may capture a self-closing <w:p .../> tag and
        // accidentally generate invalid XML like:
        //   <w:p .../> <w:pPr> ...
        const afterHeading = out.slice(headingParaEnd);
        const paraRe = /<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
        let listParaXml = "";
        let m: RegExpExecArray | null;
        while ((m = paraRe.exec(afterHeading))) {
          const para = m[0];
          if (para.includes("<w:numPr>")) {
            listParaXml = para;
            break;
          }
        }

        const openTag = (headingParaXml.match(/^<w:p[^>]*>/) || ["<w:p>"])[0];
        const pPr = (headingParaXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || ["<w:pPr/>"])[0];

        let listOpenTag = (listParaXml.match(/^<w:p[^>]*>/) || [openTag])[0];
        // Defensive: if the opening tag is self-closing (<w:p .../>), convert it to a real open tag.
        if (listOpenTag.endsWith("/>")) listOpenTag = listOpenTag.replace(/\/>$/, ">");
        const listPPr = (listParaXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [pPr])[0];

        const esc = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const mkHeadingPara = (headingText: string, bodyText: string) => {
          // Keep the same structure as the existing heading paragraph, but swap the heading and body.
          let x = headingParaXml;
          x = x.replace(
            /<w:t>Distribution of the Trust Estate at My Death<\/w:t>/,
            `<w:t>${esc(headingText)}</w:t>`
          );
          x = x.replace(
            /<w:t xml:space="preserve">[^<]*<\/w:t>/,
            `<w:t xml:space="preserve">${esc(bodyText)}</w:t>`
          );
          return x;
        };

        const mkListPara = (text: string) =>
          `${listOpenTag}${listPPr}<w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;

        const spouseSurvivesHeading = mkHeadingPara(
          "Distribution at My Death if My Spouse Survives",
          " On my death and if [[SPOUSEFIRSTNAME]] survives me, the Trustee shall hold, administer and distribute the trust fund, as then constituted, plus any additions thereto as a result of my death (all of which is hereafter referred to as the \u201cTrust Estate\u201d) as follows:"
        );

        const spouseSurvivesTPP = mkListPara(
          "The Trustee shall distribute my tangible personal property to [[SPOUSEFirstname]]."
        );
        const spouseSurvivesResidue = mkListPara(
          "The Trustee shall distribute the residue of the Trust Estate to the then-acting Trustee of that certain trust agreement known as THE [[SPOUSEFULLNAME]] LIVING TRUST, executed by [[SPOUSEFULLNAME]] (my spouse) concurrently herewith."
        );

        const spousePredeceasesHeading = mkHeadingPara(
          "Distribution at My Death if My Spouse Predeceases Me",
          " On my death if [[SPOUSEFIRSTNAME]] shall predecease me, the Trustee shall hold, administer and distribute the Trust Estate as follows:"
        );

        // Replace the original heading paragraph with:
        //   spouse-survives heading + 2 list paras + spouse-predeceases heading
        out =
          out.slice(0, headingParaStart) +
          spouseSurvivesHeading +
          spouseSurvivesTPP +
          spouseSurvivesResidue +
          spousePredeceasesHeading +
          out.slice(headingParaEnd);
      }
    }
  }

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

function scrubEmptyUnderlinedOrBorderParagraphs(xml: string) {
  // Some templates use empty paragraphs with underline/borders as visual “lines”.
  // After token substitution, docxtemplater can leave behind paragraphs that are
  // *visibly blank* but still draw an underline/border (the “mystery extra blank underline”).
  //
  // We must NOT delete the entire <w:p> because in WordprocessingML a table cell (<w:tc>)
  // must contain at least one paragraph; deleting the only <w:p> can corrupt the DOCX.
  //
  // Instead, when the paragraph is empty, we strip the underline/border styling and keep
  // an empty paragraph in place.
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    const hasUnderline = /<w:u\b[^>]*w:val="single"/.test(para);
    const hasBorder = /<w:pBdr>/.test(para);
    if (!hasUnderline && !hasBorder) return para;

    const texts = [...para.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);

    // Consider the paragraph “blank” when it has no <w:t>, or all <w:t> are whitespace.
    const allBlank =
      texts.length === 0 ||
      texts.every((t) => t.replace(/&nbsp;|\u00A0/g, " ").trim().length === 0);

    if (!allBlank) return para;

    let out = para;
    // Drop paragraph borders.
    out = out.replace(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g, "");
    // Drop underline marks inside run properties.
    out = out.replace(/<w:u\b[^>]*\/?>/g, "");
    out = out.replace(/<\/w:u>/g, "");

    return out;
  });
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

  // Post-render cleanup: remove “empty-but-underlined/bordered” paragraphs that docxtemplater
  // can leave behind when tokens resolve to empty strings.
  const outZip = doc.getZip();
  const outXmlParts = Object.keys(outZip.files).filter((name) => {
    // Only touch XML parts that contain body paragraphs.
    if (name === "word/document.xml") return true;
    if (/^word\/header\d+\.xml$/.test(name)) return true;
    if (/^word\/footer\d+\.xml$/.test(name)) return true;
    return false;
  });
  for (const name of outXmlParts) {
    const f = outZip.file(name);
    if (!f) continue;
    const xml = f.asText();
    const cleaned = scrubEmptyUnderlinedOrBorderParagraphs(xml);
    if (cleaned !== xml) outZip.file(name, cleaned);
  }

  const out = outZip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;

  return { buffer: out, missingTokens: [...missingTokens].sort() };
}

export function repoTemplatePath(relFromRepoRoot: string) {
  // In Vercel, process.cwd() should be the web root (Root Directory = web)
  // Repo root is one level up.
  return path.resolve(process.cwd(), "..", relFromRepoRoot);
}
