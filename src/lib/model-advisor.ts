/**
 * Model Advisor — FP16/FP32 detection + TTFT (time-to-first-token) tracking.
 *
 * Calls Ollama's /api/show to inspect the active model's quantization level.
 * If the model is running in full-precision (F16/F32/BF16), it logs an actionable
 * suggestion and flags the health endpoint.
 *
 * TTFT is measured per-request in the chat route via onChunk and fed to recordTTFT().
 * A rolling 10-request average is exposed for the health endpoint.
 */

import { GROQ_MODEL } from "@/shared/constants";

// Quantization levels that indicate full or near-full precision (heavy RAM/VRAM usage)
const HEAVY_QUANTS = new Set(["F16", "F32", "BF16"]);

const QUANT_SUGGESTIONS: Record<string, string> = {
  F16: [
    "F16 precision uses ~16 GB VRAM and is 3-4× slower than a quantized model.",
    `Switch to Q4_K_M (~4.9 GB, minimal quality loss): ollama pull ${GROQ_MODEL}`,
    "Or create a Modelfile: FROM qwen3:8b\\nPARAMETER quantize Q4_K_M",
  ].join(" "),
  F32: [
    "F32 precision uses ~32 GB VRAM — unusable on most hardware.",
    `Switch immediately: ollama pull ${GROQ_MODEL} (default ships as Q4_K_M)`,
  ].join(" "),
  BF16: [
    "BF16 uses ~16 GB VRAM. Consider Q5_K_M (better quality/speed trade-off)",
    `or Q4_K_M (fastest) for everyday chat.`,
  ].join(" "),
};

// ── TTFT rolling window ────────────────────────────────────────────────────────

/** Rolling window of the last 10 TTFT measurements (ms). Lives on globalThis so it
 *  survives HMR reloads without resetting. */
const g = globalThis as typeof globalThis & {
  __ttftWindow?: number[];
};

function getTTFTWindow(): number[] {
  if (!g.__ttftWindow) g.__ttftWindow = [];
  return g.__ttftWindow;
}

/**
 * Record a time-to-first-token measurement.
 * Called from the chat route's onChunk handler with `Date.now() - requestStart`.
 */
export function recordTTFT(ms: number): void {
  const window = getTTFTWindow();
  window.push(ms);
  if (window.length > 10) window.shift();

  if (ms > 10_000) {
    console.warn(
      `[model-advisor] Slow TTFT: ${ms} ms (threshold: 10 000 ms). ` +
        `Model: ${GROQ_MODEL}. Check xAI status at https://status.x.ai`,
    );
  }
}

/** Average TTFT over the last 10 requests, or null if no data yet. */
export function getAverageTTFT(): number | null {
  const window = getTTFTWindow();
  if (window.length === 0) return null;
  return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
}

// ── Model info ─────────────────────────────────────────────────────────────────

export interface ModelInfo {
  quantizationLevel: string | null;
  parameterSize: string | null;
  family: string | null;
  /** True when running F16, F32, or BF16 — high VRAM, slow inference. */
  isHeavyPrecision: boolean;
  /** Actionable suggestion if isHeavyPrecision is true, otherwise null. */
  suggestion: string | null;
}

function emptyModelInfo(): ModelInfo {
  return {
    quantizationLevel: null,
    parameterSize: null,
    family: null,
    isHeavyPrecision: false,
    suggestion: null,
  };
}

/**
 * Grok (xAI) is a cloud API — quantization details are not exposed.
 * Returns static info based on the configured model name.
 */
export async function checkModelInfo(): Promise<ModelInfo> {
  return {
    quantizationLevel: null,
    parameterSize: null,
    family: "grok",
    isHeavyPrecision: false,
    suggestion: null,
  };
}
