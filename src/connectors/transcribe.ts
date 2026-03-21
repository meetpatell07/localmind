/**
 * Voice-to-text transcription via Groq Whisper API (free, fast).
 *
 * Accepts an audio buffer (OGG/opus from Telegram voice notes)
 * and returns the transcribed text.
 *
 * Requires: GROQ_API_KEY in .env.local
 * Falls back to OPENAI_API_KEY if GROQ_API_KEY is not set.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface TranscriptionResult {
  text: string;
  source: "groq" | "openai";
}

/**
 * Transcribe an audio buffer to text using Whisper.
 * Tries Groq first (free), then OpenAI as fallback.
 */
export async function transcribeAudio(
  buffer: Buffer,
  fileName: string
): Promise<TranscriptionResult | null> {
  if (GROQ_API_KEY) {
    const text = await callWhisperApi(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      GROQ_API_KEY,
      buffer,
      fileName,
      "whisper-large-v3"
    );
    if (text) return { text, source: "groq" };
  }

  if (OPENAI_API_KEY) {
    const text = await callWhisperApi(
      "https://api.openai.com/v1/audio/transcriptions",
      OPENAI_API_KEY,
      buffer,
      fileName,
      "whisper-1"
    );
    if (text) return { text, source: "openai" };
  }

  return null;
}

/** Returns true if at least one transcription API key is configured. */
export function isTranscriptionAvailable(): boolean {
  return !!(GROQ_API_KEY || OPENAI_API_KEY);
}

async function callWhisperApi(
  url: string,
  apiKey: string,
  buffer: Buffer,
  fileName: string,
  model: string
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), fileName);
    form.append("model", model);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      console.error(`[transcribe] ${url} returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch (err) {
    console.error("[transcribe] error:", err);
    return null;
  }
}
