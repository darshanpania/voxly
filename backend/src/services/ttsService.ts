import OpenAI from "openai";
import type { Readable } from "node:stream";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function synthesizeSpeech(
  text: string,
  _language: string,
): Promise<Readable> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
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
