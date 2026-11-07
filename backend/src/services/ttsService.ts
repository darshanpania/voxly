import OpenAI from "openai";
import type { Readable } from "node:stream";
import { env } from "../env.js";
import { MODELS } from "./aiModels.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// gpt-4o-mini-tts follows spoken-style instructions. The tutor mixes Spanish
// and English in one reply, so ask for native pronunciation of each.
const TTS_INSTRUCTIONS =
  "You are Sofía, a warm, patient language tutor. Speak clearly at a relaxed pace. " +
  "Pronounce Spanish words with a natural, neutral Latin American Spanish accent, " +
  "and English words with a natural American English accent. Switch accent " +
  "seamlessly when the language changes mid-sentence.";

export async function synthesizeSpeech(
  text: string,
  _language: string,
): Promise<Readable> {
  const supportsInstructions = !MODELS.tts.startsWith("tts-1");

  const response = await openai.audio.speech.create({
    model: MODELS.tts,
    voice: MODELS.ttsVoice,
    input: text,
    response_format: "mp3",
    ...(supportsInstructions ? { instructions: TTS_INSTRUCTIONS } : {}),
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
