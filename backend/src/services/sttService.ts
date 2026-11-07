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

  // Voxly is a bilingual tutor: the learner switches freely between English
  // ("How do I say ... in Spanish?") and the target language. Forcing
  // `language` makes Whisper mangle English questions into Spanish, so let it
  // auto-detect and bias it with a short bilingual prompt instead.
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    prompt: bilingualPrompt(language),
    response_format: "verbose_json",
  });

  // verbose_json responses include a numeric `duration` (seconds).
  const duration =
    typeof (response as { duration?: number }).duration === "number"
      ? (response as { duration: number }).duration
      : undefined;

  return { transcript: response.text, duration };
}

/**
 * Whisper uses the prompt as preceding context, which nudges it toward the
 * right spelling, punctuation and language for short mixed-language turns.
 */
function bilingualPrompt(language: string): string {
  if (language === "es") {
    return "Conversación entre una tutora de español y su alumno, en español y en inglés. How do I say 'I'm hungry' in Spanish? Tengo hambre. What does 'madrugar' mean? ¿Cómo se dice 'tired'?";
  }
  return "A bilingual language lesson that mixes English with the target language.";
}

function mimeFromFilename(filename: string): string {
  if (filename.endsWith(".webm")) return "audio/webm";
  if (filename.endsWith(".mp4")) return "audio/mp4";
  if (filename.endsWith(".wav")) return "audio/wav";
  return "audio/webm";
}
