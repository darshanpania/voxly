import OpenAI from "openai";
import { env } from "../env.js";
import { MODELS, isWhisperModel } from "./aiModels.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TranscriptionResult {
  transcript: string;
  /** Audio duration in seconds, when the model reports it (whisper-1 only). */
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

  // whisper-1 takes a single `language`. gpt-transcribe takes `languages`, so
  // we pass both the target language and English: the learner switches
  // between them mid-sentence ("how do I say ... in Spanish?").
  const languages = Array.from(new Set([language, "en"]));
  const params = isWhisperModel(MODELS.stt)
    ? {
        model: MODELS.stt,
        file,
        language,
        response_format: "verbose_json" as const,
      }
    : // `languages` is newer than the SDK's types, so widen the param type.
      ({ model: MODELS.stt, file, languages } as unknown as {
        model: string;
        file: File;
      });

  const response = await openai.audio.transcriptions.create(params);

  // Only whisper verbose_json reports `duration` (seconds). Callers estimate
  // the duration when it is missing.
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
