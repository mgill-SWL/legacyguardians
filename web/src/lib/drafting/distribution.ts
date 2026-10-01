// AI-assisted drafting of the BESPOKE distribution provisions for a revocable
// living trust. This turns the client's free-text distribution wishes (captured
// at intake in the EPIS editor at intake.wishes.distribution) into formal clause
// language that the attorney reviews and edits before it is used.
//
// Design note: the firm's trust templates already contain vetted DEFAULT
// residuary language (equal shares to then-living issue, per stirpes). This
// drafter produces ONLY the client-specific overlay (specific gifts, unequal or
// staggered shares, charitable gifts, conditions, etc.) — it never restates the
// boilerplate. That keeps the vetted template intact; see renderTemplate.ts.

import type { IntakeV1 } from "@/lib/intakeTypes";
import { claudeComplete } from "@/lib/ai/anthropic";

export type DistributionDraft = {
  /** The drafted clause text, or "" when only the template default applies. */
  clause: string;
  /** Attorney-facing issues: ambiguities, missing details, legal flags. */
  notes: string[];
};

export type DistributionDraftResult =
  | { ok: true; draft: DistributionDraft; model: string }
  | { ok: false; error: string; needsKey?: boolean };

function wishText(intake: IntakeV1, who: "spouse1" | "spouse2"): string {
  return (intake.wishes?.distribution?.[who]?.text || "").trim();
}

function factSummary(intake: IntakeV1): string {
  const g2 = intake.grantors?.[1] || "";
  const kids = (intake.children || []).map((c) => c.name).filter(Boolean);
  return [
    `Offering: ${intake.offering}`,
    g2 ? "Clients: a married couple" : "Client: a single grantor",
    `State of residence: ${intake.clientAddress?.state || "(unspecified)"}`,
    kids.length ? `Children: ${kids.join(", ")}` : "Children: none recorded",
  ].join("\n");
}

const SYSTEM_PROMPT = `You are a senior Virginia estate-planning attorney drafting for Speedwell Law, a Virginia firm. You draft the BESPOKE distribution provisions for a revocable living trust.

How your output is used:
- The firm's trust template ALREADY contains vetted default residuary language (equal shares to the grantor's then-living issue, per stirpes, with standard contingent-beneficiary and lapse provisions).
- Your job is ONLY the client-specific distribution instructions that MODIFY or SUPPLEMENT that default — e.g. specific gifts of money or property, unequal or fractional shares, gifts to charities, staggered distributions by age, retained-in-trust or special-needs provisions, conditions, or disinheritance.
- If the client's wishes are simply the standard "all to the surviving spouse, then equally to the children per stirpes," the template default already covers it: return an EMPTY clause and say so in the notes. Never restate boilerplate.

Drafting rules:
- Write formal, operative trust language suitable to paste into the trust's distribution article. Use the firm's defined terms: "Grantor"/"Grantors", "Trustee", "Trust Estate", "issue", "per stirpes".
- Refer to beneficiaries by the names provided. Do NOT invent names, dollar amounts, ages, relationships, or charities that were not supplied.
- Be precise about contingencies (what happens if a beneficiary predeceases; whether a gift lapses or passes to that beneficiary's issue).
- Draft operative language only. Do NOT give tax advice or opinions.
- If any instruction is ambiguous, internally inconsistent, legally problematic, or missing a needed detail (a dollar amount, an age, a charity's full legal name, a lapse rule), DO NOT guess. Draft what you reasonably can and list every such issue in "notes" for the attorney to resolve.

Output: respond with ONLY a valid JSON object, no markdown code fences, of exactly this shape:
{"clause": "<drafted clause text, or empty string if only the template default applies>", "notes": ["<attorney-facing note>", "..."]}`;

function parseDraft(raw: string): DistributionDraft {
  let text = raw.trim();
  // Strip ```json ... ``` fences if the model added them despite instructions.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = (fence[1] ?? "").trim();

  try {
    const obj = JSON.parse(text) as { clause?: unknown; notes?: unknown };
    const clause = typeof obj.clause === "string" ? obj.clause.trim() : "";
    const notes = Array.isArray(obj.notes)
      ? obj.notes.filter((n): n is string => typeof n === "string")
      : [];
    return { clause, notes };
  } catch {
    // Non-JSON fallback: keep the text as the clause but flag it for review.
    return {
      clause: text,
      notes: ["The model did not return structured output; review the text carefully before use."],
    };
  }
}

export async function draftDistribution(
  intake: IntakeV1,
  attorneyInstructions?: string,
): Promise<DistributionDraftResult> {
  const g1 = intake.grantors?.[0] || "Grantor 1";
  const g2 = intake.grantors?.[1] || "";
  const w1 = wishText(intake, "spouse1");
  const w2 = wishText(intake, "spouse2");

  const prompt = [
    "MATTER FACTS:",
    factSummary(intake),
    "",
    "CLIENT DISTRIBUTION WISHES (captured at intake, verbatim):",
    `- ${g1}: ${w1 || "(none recorded)"}`,
    ...(g2 ? [`- ${g2}: ${w2 || "(none recorded)"}`] : []),
    "",
    "ADDITIONAL ATTORNEY INSTRUCTIONS:",
    (attorneyInstructions || "").trim() || "(none)",
    "",
    "Draft the bespoke distribution provisions per your rules. Respond with ONLY the JSON object.",
  ].join("\n");

  const res = await claudeComplete({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 4000,
    temperature: 0.2,
  });
  if (!res.ok) return { ok: false, error: res.error, needsKey: res.needsKey };

  return { ok: true, draft: parseDraft(res.text), model: res.model };
}
