/**
 * The one place fitness_app generates images with a model. Celebrations uses it for
 * background art; later workflows reuse it. Deterministic callers decide *what* to generate
 * and cache the result; this only makes the call.
 *
 * Env: OPENAI_API_KEY (required), CELEBRATION_IMAGE_MODEL (optional, default gpt-image-1.5;
 * this key also has gpt-image-2 and gpt-image-1-mini as of Nov 2026).
 * Tracing: each call is logged through `onImageCall` (stdout for now; Langfuse in Phase 2 once
 * fitness_app has the keys). See ai-crew/docs/BUSINESS-ACCOUNTABILITY.md.
 */

export interface ImageRequest {
  prompt: string;
  /** Square unless a caller needs otherwise */
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
  /** Who asked, for the log (e.g. "celebrations:birthday") */
  purpose: string;
}

export interface ImageResult {
  png: Buffer;
  model: string;
  ms: number;
}

const DEFAULT_MODEL = process.env.CELEBRATION_IMAGE_MODEL ?? "gpt-image-1.5";

export async function generateImage(req: ImageRequest): Promise<ImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt: req.prompt,
      size: req.size ?? "1024x1024",
      quality: req.quality ?? "medium",
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Image generation failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no image");
  const result = { png: Buffer.from(b64, "base64"), model: DEFAULT_MODEL, ms: Date.now() - started };
  onImageCall({ purpose: req.purpose, model: result.model, ms: result.ms, bytes: result.png.length, prompt: req.prompt });
  return result;
}

/** One log line per model call. Replace with a Langfuse generation in Phase 2. */
function onImageCall(call: { purpose: string; model: string; ms: number; bytes: number; prompt: string }) {
  console.log(`[ai:image] ${call.purpose} model=${call.model} ${call.ms}ms ${Math.round(call.bytes / 1024)}KB prompt="${call.prompt.slice(0, 80)}…"`);
}
