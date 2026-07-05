import OpenAI from "openai";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TranscriptionResult {
  transcript: string;
  /** Audio duration in seconds, when Whisper reports it (verbose_json). */
  duration?: number;
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
    response_format: "verbose_json",
  });

  // verbose_json responses include a numeric `duration` (seconds).
  const duration =
    typeof (response as { duration?: number }).duration === "number"
      ? (response as { duration: number }).duration
      : undefined;

  return { transcript: response.text, duration };
}

function mimeFromFilename(filename: string): string {
  if (filename.endsWith(".webm")) return "audio/webm";
  if (filename.endsWith(".mp4")) return "audio/mp4";
  if (filename.endsWith(".wav")) return "audio/wav";
  return "audio/webm";
}
