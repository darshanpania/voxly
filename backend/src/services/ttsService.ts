import OpenAI from "openai";
import type { Readable } from "node:stream";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Voice per language; falls back to "nova" for anything unmapped.
const VOICES: Record<string, string> = {
  es: "nova",
  default: "nova",
};

export async function synthesizeSpeech(
  text: string,
  language: string,
): Promise<Readable> {
  const voice = VOICES[language] ?? VOICES.default;

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    response_format: "mp3",
  });

  const nodeResponse = response as unknown as { body: Readable };
  if (nodeResponse.body && typeof nodeResponse.body.pipe === "function") {
    return nodeResponse.body;
  }

  // Fallback: buffer the response and create a readable stream
  const { Readable } = await import("node:stream");
  const arrayBuffer = await response.arrayBuffer();
  return Readable.from(Buffer.from(arrayBuffer));
}
