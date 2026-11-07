/**
 * Single place that decides which OpenAI models Voxly uses.
 *
 * Defaults (Nov 2026):
 * - chat:  gpt-6.1-terra  — the live tutor reply. ~2.5x cheaper than gpt-4o and
 *          newer; run with reasoning_effort "none" so first-token latency stays
 *          low for voice.
 * - fast:  gpt-6-luna     — background JSON jobs (feedback recovery, session
 *          summary). ~25x cheaper than gpt-4o.
 * - stt:   gpt-transcribe — replaces whisper-1 (shuts down 2027-02-26). Accepts
 *          several languages at once, so mixed English/Spanish speech works.
 * - tts:   gpt-4o-mini-tts — replaces tts-1 (worse quality). Supports
 *          `instructions` and the newer `marin`/`cedar` voices. Note: every
 *          /v1/audio/speech model shuts down 2027-01-06; the long-term path is
 *          the Realtime/Live API.
 *
 * Every value can be overridden with an env var, so a model can be swapped
 * (or rolled back to gpt-4o / whisper-1 / tts-1) without a code change.
 */
import type OpenAI from "openai";

export const MODELS = {
  chat: process.env.VOXLY_CHAT_MODEL || "gpt-6.1-terra",
  fast: process.env.VOXLY_FAST_MODEL || "gpt-6-luna",
  stt: process.env.VOXLY_STT_MODEL || "gpt-transcribe",
  tts: process.env.VOXLY_TTS_MODEL || "gpt-4o-mini-tts",
  ttsVoice: process.env.VOXLY_TTS_VOICE || "marin",
} as const;

/** Reasoning effort for the GPT-5+/GPT-6 models. "none" = lowest latency. */
const REASONING_EFFORT = (process.env.VOXLY_REASONING_EFFORT ||
  "none") as OpenAI.ReasoningEffort;

/** Legacy (non-reasoning) chat models that still take temperature/max_tokens. */
function isLegacyChatModel(model: string): boolean {
  return /^(gpt-4|gpt-3\.5)/.test(model);
}

/**
 * Sampling/length params that are valid for the given model. Reasoning models
 * reject `max_tokens` and may reject `temperature`, so we send
 * `max_completion_tokens` + `reasoning_effort` to them instead.
 */
export function chatParams(
  model: string,
  opts: { temperature: number; maxTokens: number },
): Pick<
  OpenAI.ChatCompletionCreateParams,
  "model" | "temperature" | "max_completion_tokens" | "reasoning_effort"
> {
  if (isLegacyChatModel(model)) {
    return {
      model,
      temperature: opts.temperature,
      max_completion_tokens: opts.maxTokens,
    };
  }
  return {
    model,
    reasoning_effort: REASONING_EFFORT,
    max_completion_tokens: opts.maxTokens,
  };
}

/** True when the STT model is the legacy Whisper API (single `language`). */
export function isWhisperModel(model: string): boolean {
  return model.startsWith("whisper");
}
