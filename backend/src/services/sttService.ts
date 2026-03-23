import OpenAI from "openai";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TranscriptionResult {
  transcript: string;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string,
  filename: string,
): Promise<TranscriptionResult> {
  const file = new File([audioBuffer], filename, {
    type: mimeFromFilename(filename),
  });

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: language === "es" ? "es" : language,
  });

  return { transcript: response.text };
}

function mimeFromFilename(filename: string): string {
  if (filename.endsWith(".webm")) return "audio/webm";
  if (filename.endsWith(".mp4")) return "audio/mp4";
  if (filename.endsWith(".wav")) return "audio/wav";
  return "audio/webm";
}
