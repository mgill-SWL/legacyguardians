// Thin Anthropic Messages API client. No SDK dependency — this mirrors the
// plain-fetch pattern already used for OpenAI in
// web/src/app/api/support/chat/route.ts, so we don't add a package just to
// talk to Claude. Gated by ANTHROPIC_API_KEY; callers get a clear, recoverable
// error when the key is not set (same UX as the support chatbot).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// A strong, cost-effective current model by default. For the highest drafting
// quality, set ANTHROPIC_MODEL=claude-opus-5 in the environment.
const DEFAULT_MODEL = "claude-sonnet-5";

export type ClaudeResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; needsKey?: boolean };

export function anthropicConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export async function claudeComplete(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<ClaudeResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return {
      ok: false,
      needsKey: true,
      error:
        "ANTHROPIC_API_KEY is not set on the server yet. Add it in Vercel env vars (and .env.local for local dev) and redeploy to enable AI drafting.",
    };
  }

  const model = opts.model || process.env["ANTHROPIC_MODEL"] || DEFAULT_MODEL;

  let r: Response;
  try {
    r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4000,
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach the Anthropic API." };
  }

  type AnthropicContentBlock = { type?: string; text?: string };
  type AnthropicResponse = {
    error?: { message?: string };
    content?: AnthropicContentBlock[];
  };
  const data = (await r.json().catch(() => null)) as AnthropicResponse | null;

  if (!r.ok) {
    return { ok: false, error: data?.error?.message || `Anthropic error ${r.status}` };
  }

  const text = (data?.content || [])
    .filter((b) => b?.type === "text")
    .map((b) => b?.text || "")
    .join("")
    .trim();

  if (!text) return { ok: false, error: "The model returned an empty response." };
  return { ok: true, text, model };
}
