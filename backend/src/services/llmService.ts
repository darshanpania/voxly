import OpenAI from "openai";
import { env } from "../env.js";
import { getVocabDueForReview } from "./progressService.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Thrown when the tutor response cannot be obtained or parsed after retries.
 * The message is intentionally generic — callers must NOT surface underlying
 * OpenAI/parse error internals to users or persist them as tutor content.
 */
export class TutorResponseError extends Error {
  constructor(message = "Failed to generate a tutor response") {
    super(message);
    this.name = "TutorResponseError";
  }
}

/** Strip a leading/trailing markdown code fence (```json … ```) if present. */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

export interface ReplyLine {
  es: string;
  en: string;
}

export interface TutorResponse {
  reply: string;
  reply_translation?: string;
  reply_lines: ReplyLine[];
  feedback: {
    corrections: Array<{
      original: string;
      corrected: string;
      explanation: string;
    }>;
    vocab_notes: Array<{
      word: string;
      definition: string;
      example: string;
      category?: string;
    }>;
    difficulty_signal: "too_easy" | "on_track" | "too_hard";
    awaiting_correction?: boolean;
  };
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const DIFFICULTY_GUIDES: Record<string, string> = {
  A1: "Present tense only. Use only the 100 most common words. Single-clause sentences. Speak very simply.",
  A2: "Present tense + simple past/future. ~500 word vocabulary. Simple questions. Short sentences.",
  B1: "All basic tenses. Common idioms allowed. Multi-clause sentences. Moderate complexity.",
  B2: "Subjunctive, conditional, complex clauses. Idiomatic speech. Natural conversation flow.",
  C1: "Near-native level. Regional variations. Humor and cultural references welcome. Sophisticated vocabulary.",
  C2: "Full native-level Spanish. No simplification. Register-switching. Treat the learner as fluent.",
};

async function buildSystemPrompt(
  language: string,
  difficulty: string,
  mode: string,
  userId?: string,
  format: "json" | "stream" = "json",
): Promise<string> {
  const difficultyGuide =
    DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];
  const langName = language === "es" ? "Spanish" : language;
  const modeInstruction =
    mode === "immersion"
      ? `IMMERSION MODE: Hold the conversation only in ${langName}. If the learner is struggling, rephrase in simpler ${langName} instead of switching to English. The ONE exception is a direct tutor question asked in English ("How do I say…?", "What does … mean?"): answer it briefly in English, then go straight back to ${langName}.`
      : `HELPER MODE: Hold the conversation in ${langName}, but switch to English whenever it helps — to explain grammar, give a meaning, or help when the learner is stuck.`;

  // Shared prompt body — identical for both the JSON and streaming paths. Only
  // the OUTPUT FORMAT section below differs between formats.
  const sharedHead = `You are Sofia, a warm and encouraging ${langName} language tutor. You are patient, friendly, and adapt to the student's level.

DIFFICULTY LEVEL: ${difficulty} (applies to your ${langName}; keep any English short and plain)
${difficultyGuide}

${modeInstruction}

VOICE-ONLY LESSON (CRITICAL): The student talks to you by voice only. Their words reach you as a speech-to-text transcript, and your reply is read aloud by a text-to-speech voice. So:
- Write the way you talk. No markdown, lists, headings, emoji, or symbols that a voice cannot read.
- Keep replies short: usually 1-3 sentences, never more than about 60 words.
- The transcript can contain recognition errors. If a word looks odd, assume the similar-sounding word the student most likely meant. Never correct spelling, accents, punctuation, or capitals — the student cannot control them. Only correct grammar, word choice, and words that were clearly said wrong.

BILINGUAL TUTOR (CRITICAL): The student moves freely between English and ${langName}. Each turn, work out what they want and answer in the right language:
1. "How do I say X?" / "How would I say X in ${langName}?" / "¿Cómo se dice X?" — Answer in English in one short sentence, give the natural ${langName} phrase at their level, and add at most one quick tip (a tricky sound or word) if useful. Then ask them to say it out loud. Do not move on until they try.
2. The student tries a phrase you just taught — If it is right (allow for transcription noise), praise them briefly in ${langName}, then answer what they said in ${langName}, as if they had said it to you in a real conversation (for example, they say "Tengo hambre" and you reply "¡Perfecto! ¿Y qué te apetece comer?"). If it is wrong, say what to fix in short, plain English and ask them to try again.
3. "What does X mean?" / "What did you just say?" / "I don't understand" / "Say that in English" / "¿Qué significa X?" — Explain in English: the meaning, plus a short usage or grammar note only if it helps. X is usually something you said earlier, so look back in the conversation. Then switch back to ${langName} with a simple question that uses the word or continues the conversation.
4. The student speaks ${langName} — Reply in ${langName} and keep the conversation going, with corrections as below.
5. Other English talk (not a question about ${langName}) — Reply briefly, then invite them back into ${langName} with a simple question.
When one reply mixes languages, keep each sentence in one language where you can, so the voice reads it naturally (for example: "In ${langName} you say it like this. Tengo hambre."). Whenever you teach or explain a word or phrase, add it to vocab_notes.
When an English sentence quotes a ${langName} word or phrase, wrap the ${langName} part in «guillemets» (for example: Because «gente» is feminine.). The app uses the marks to color the ${langName} words. Do not use the marks anywhere else.

CORRECTION APPROACH (CRITICAL — follow this strictly):
- Only correct the student's ${langName}. Never correct their English, and never treat an English question as a mistake.
- When the student makes errors, FIRST acknowledge what they tried to say, then clearly show the correction.
- After correcting, ask the student to rephrase or repeat the corrected form BEFORE moving to new content.
- Use a format like: "¡Casi! You said '[incorrect]', but it should be '[correct]' because [reason]. Can you try saying it again?"
- Only move to new questions or topics AFTER the student demonstrates understanding of the correction.
- If the student's retry still has errors, gently correct again but simplify your explanation.
- When the student successfully corrects themselves, be extra encouraging: "¡Perfecto! That's exactly right!"
- Set "awaiting_correction" to true when you've asked the student to retry a correction.
- Set "awaiting_correction" to false when the student has successfully corrected themselves or when there are no corrections needed.`;

  // Detailed feedback field descriptions, shared by both output formats.
  const feedbackSchema = `  "feedback": {
    "corrections": [
      {
        "original": "what the student said incorrectly",
        "corrected": "the correct form",
        "explanation": "brief explanation in English"
      }
    ],
    "vocab_notes": [
      {
        "word": "a Spanish word in dictionary/lemma form: lowercase, no leading articles, no punctuation (e.g. \"comer\", not \"El Comer.\")",
        "definition": "English definition",
        "example": "example sentence using the word",
        "category": "one of: greetings, food, travel, numbers, family, work, nature, emotions, shopping, health, general"
      }
    ],
    "difficulty_signal": "too_easy" | "on_track" | "too_hard",
    "awaiting_correction": false
  }`;

  const jsonFormat = `You MUST respond with valid JSON matching this exact schema (no markdown fences, no extra text):
{
  "reply": "Your full spoken reply (${langName}, English, or both, as the turn needs)",
  "reply_lines": [
    { "es": "Each sentence of your reply, exactly as written", "en": "Its English translation" },
    { "es": "Another sentence of your reply", "en": "Its English translation" }
  ],
${feedbackSchema}
}

IMPORTANT: "reply_lines" must break your reply into individual sentences, each with the sentence as written ("es") and its English translation ("en"). If a sentence is already in English, put the same English text in both fields. Every sentence in "reply" must appear in "reply_lines".`;

  const streamFormat = `OUTPUT FORMAT — follow this EXACTLY, in this exact order:
1. FIRST, output ONLY your spoken reply as plain text (${langName}, English, or both, as the turn needs). This is shown to the student immediately, so write just the natural reply — no JSON, no labels, no markdown.
2. THEN output a line containing exactly this delimiter and nothing else:
===FEEDBACK===
3. THEN output a single JSON object (no markdown fences, no extra text) with this exact schema:
{
  "reply_lines": [
    { "es": "Each sentence of your reply, exactly as written", "en": "Its English translation" },
    { "es": "Another sentence of your reply", "en": "Its English translation" }
  ],
${feedbackSchema}
}

IMPORTANT: "reply_lines" must break the plain-text reply you wrote in step 1 into individual sentences, each with the sentence as written ("es") and its English translation ("en"). If a sentence is already in English, put the same English text in both fields. Every sentence of your reply must appear in "reply_lines".
Never write "===FEEDBACK===" anywhere inside the plain-text reply, and never output anything after the JSON object.`;

  const guidelines = `Guidelines:
- Keep corrections helpful, not overwhelming. Focus on the most important errors.
- Include 1-3 vocab notes per response highlighting useful words, always with a category.
- Set difficulty_signal based on how well the student is performing at the current level.
- Be conversational and natural. Ask follow-up questions to keep the conversation going.
- If there are no errors to correct, return an empty corrections array and set awaiting_correction to false.`;

  const base = `${sharedHead}

${format === "stream" ? streamFormat : jsonFormat}

${guidelines}`;

  if (userId) {
    try {
      const dueVocab = await getVocabDueForReview(userId, language);
      if (dueVocab.length > 0) {
        // Prioritize lapsed words (state=3) and low stability items
        const lapsed = dueVocab.filter((v) => v.state === 3).slice(0, 3);
        const others = dueVocab
          .filter((v) => v.state !== 3)
          .sort((a, b) => a.stability - b.stability)
          .slice(0, 5 - lapsed.length);
        const priorityWords = [...lapsed, ...others];

        if (priorityWords.length > 0) {
          const wordList = priorityWords
            .map((v) => `${v.word} (${v.category}, stability: ${v.stability.toFixed(1)})`)
            .join(", ");
          return (
            base +
            `\n\nVOCABULARY REINFORCEMENT: Naturally weave these words into the conversation — they need practice: [${wordList}]. Prioritize words with lower stability as the student is more likely to forget them.`
          );
        }
      }
    } catch {
      // Non-critical — continue without vocab reinforcement
    }
  }

  return base;
}

export async function getTutorResponse(
  language: string,
  difficulty: string,
  mode: string,
  history: ConversationMessage[],
  userMessage: string,
  userId?: string,
): Promise<TutorResponse> {
  const systemPrompt = await buildSystemPrompt(language, difficulty, mode, userId);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2048,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from OpenAI");

      let parsed: TutorResponse;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // The model occasionally wraps JSON in markdown fences despite the
        // instructions — strip them and try once more before failing the attempt.
        parsed = JSON.parse(stripMarkdownFences(raw));
      }

      // Validate required fields
      if (!parsed.reply || !parsed.feedback) {
        throw new Error("Missing required fields in response");
      }

      // Ensure arrays exist
      parsed.feedback.corrections = parsed.feedback.corrections || [];
      parsed.feedback.vocab_notes = parsed.feedback.vocab_notes || [];
      parsed.feedback.difficulty_signal =
        parsed.feedback.difficulty_signal || "on_track";
      parsed.feedback.awaiting_correction =
        parsed.feedback.awaiting_correction || false;
      parsed.reply_lines = parsed.reply_lines || [{ es: parsed.reply, en: parsed.reply_translation || parsed.reply }];

      return parsed;
    } catch {
      // Swallow the attempt-level error (which may contain OpenAI/parse
      // internals) and retry. After the final attempt, throw a typed error so
      // callers can fail cleanly instead of persisting a fabricated reply.
      if (attempt === 1) {
        throw new TutorResponseError();
      }
    }
  }

  // Unreachable — the loop either returns or throws above.
  throw new TutorResponseError();
}

/** Delimiter separating the streamed plain-text reply from the trailing JSON. */
const FEEDBACK_DELIMITER = "===FEEDBACK===";

/**
 * Reliable recovery path for the streaming tutor. gpt-4o frequently ends its
 * turn right after the plain-text reply and never emits the `===FEEDBACK===`
 * JSON tail. Without this, `reply_lines` degrades to `{ es: reply, en: reply }`
 * (hover shows Spanish instead of English) and all feedback/vocab is lost.
 *
 * Given the already-produced reply, this makes a single non-streaming
 * `json_object` call to reconstruct per-sentence English translations and the
 * feedback block — the same structured data the inline tail would have carried.
 */
async function annotateStreamedReply(
  language: string,
  difficulty: string,
  mode: string,
  history: ConversationMessage[],
  userMessage: string,
  reply: string,
): Promise<{ reply_lines: ReplyLine[]; feedback: TutorResponse["feedback"] }> {
  const langName = language === "es" ? "Spanish" : language;
  const system = `You are an annotation service for a ${langName} language tutor named Sofía (difficulty level ${difficulty}, ${mode} mode). Given the student's latest message and Sofía's reply, respond with ONLY valid JSON (no markdown fences, no extra text) matching this exact schema:
{
  "reply_lines": [
    { "es": "Each sentence of Sofía's reply, copied verbatim (it may be ${langName} or English)", "en": "Its accurate, natural English translation (the same text if the sentence is already English)" }
  ],
  "feedback": {
    "corrections": [
      { "original": "what the student wrote incorrectly", "corrected": "the correct form", "explanation": "brief explanation in English" }
    ],
    "vocab_notes": [
      { "word": "a ${langName} word in lemma form: lowercase, no leading articles, no punctuation", "definition": "English definition", "example": "example sentence using the word", "category": "one of: greetings, food, travel, numbers, family, work, nature, emotions, shopping, health, general" }
    ],
    "difficulty_signal": "too_easy" | "on_track" | "too_hard",
    "awaiting_correction": false
  }
}

Rules:
- "reply_lines" MUST cover every sentence of Sofía's reply, in order. Put the sentence as written in "es" and a real English translation in "en" — never copy ${langName} text into "en".
- Only correct the student's ${langName}. An English question (for example "How do I say…?") is never a mistake.
- Add any word or phrase Sofía taught or explained to "vocab_notes".
- Derive "corrections", "vocab_notes" (1-3 useful words), and "difficulty_signal" from the student's message and the conversation. Empty corrections array if there are none.`;

  const user = `Student's message: ${userMessage}\n\nSofía's reply:\n${reply}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1024,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty annotation response");
  const parsed = JSON.parse(raw);

  const parsedFeedback = parsed?.feedback ?? {};
  const feedback: TutorResponse["feedback"] = {
    corrections: Array.isArray(parsedFeedback.corrections)
      ? parsedFeedback.corrections
      : [],
    vocab_notes: Array.isArray(parsedFeedback.vocab_notes)
      ? parsedFeedback.vocab_notes
      : [],
    difficulty_signal: parsedFeedback.difficulty_signal || "on_track",
    awaiting_correction: parsedFeedback.awaiting_correction || false,
  };
  const reply_lines: ReplyLine[] =
    Array.isArray(parsed?.reply_lines) && parsed.reply_lines.length > 0
      ? parsed.reply_lines
      : [];

  return { reply_lines, feedback };
}

export type StreamTutorEvent =
  | { type: "delta"; text: string }
  | { type: "final"; tutorResponse: TutorResponse };

/**
 * Streaming counterpart to {@link getTutorResponse}. Same inputs, but the model
 * emits the plain-text Spanish reply first (streamed to the student immediately),
 * then a `===FEEDBACK===` delimiter, then the feedback JSON.
 *
 * Yields `{ type: "delta" }` for each chunk of visible reply text and a single
 * `{ type: "final" }` carrying the assembled {@link TutorResponse} once the JSON
 * has been parsed. Throws {@link TutorResponseError} if the OpenAI stream fails
 * (before or during text) so the caller can roll back the user's message.
 */
export async function* streamTutorResponse(
  language: string,
  difficulty: string,
  mode: string,
  history: ConversationMessage[],
  userMessage: string,
  userId?: string,
): AsyncGenerator<StreamTutorEvent, void, unknown> {
  const systemPrompt = await buildSystemPrompt(
    language,
    difficulty,
    mode,
    userId,
    "stream",
  );

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  // Hold back enough trailing characters that a delimiter split across two
  // chunks is never partially emitted as reply text.
  const holdBack = FEEDBACK_DELIMITER.length;

  let buffer = ""; // reply text not yet ruled clear of the delimiter
  let replyText = ""; // full visible reply accumulated so far
  let jsonBuffer = ""; // everything after the delimiter
  let sawDelimiter = false;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    });
  } catch {
    // Failed before any text was produced — safe to roll back cleanly.
    throw new TutorResponseError();
  }

  try {
    for await (const chunk of completion) {
      const piece = chunk.choices[0]?.delta?.content;
      if (!piece) continue;

      if (sawDelimiter) {
        jsonBuffer += piece;
        continue;
      }

      buffer += piece;

      const idx = buffer.indexOf(FEEDBACK_DELIMITER);
      if (idx !== -1) {
        const before = buffer.slice(0, idx);
        if (before) {
          replyText += before;
          yield { type: "delta", text: before };
        }
        jsonBuffer += buffer.slice(idx + FEEDBACK_DELIMITER.length);
        buffer = "";
        sawDelimiter = true;
        continue;
      }

      // Delimiter not present yet. Emit everything except the tail that could
      // still turn out to be the start of the delimiter on the next chunk.
      if (buffer.length > holdBack) {
        const emit = buffer.slice(0, buffer.length - holdBack);
        buffer = buffer.slice(buffer.length - holdBack);
        replyText += emit;
        yield { type: "delta", text: emit };
      }
    }
  } catch {
    // Stream failed mid-flight. Text may already be on the wire; the route
    // still rolls back and surfaces a generic error.
    throw new TutorResponseError();
  }

  // Flush whatever remained held back (only reply text if no delimiter arrived).
  if (!sawDelimiter && buffer) {
    replyText += buffer;
    yield { type: "delta", text: buffer };
    buffer = "";
  }

  let reply = replyText.trim();

  // Graceful degradation: the student already saw the reply text, so a missing
  // or unparseable JSON tail must NOT fail the turn. Fall back to sensible
  // defaults derived from the plain-text reply.
  let feedback: TutorResponse["feedback"] = {
    corrections: [],
    vocab_notes: [],
    difficulty_signal: "on_track",
    awaiting_correction: false,
  };
  let replyLines: ReplyLine[] = [];
  let parsedTail = false;

  const cleaned = stripMarkdownFences(jsonBuffer);
  if (cleaned) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object") {
        const parsedFeedback = parsed.feedback ?? {};
        feedback = {
          corrections: Array.isArray(parsedFeedback.corrections)
            ? parsedFeedback.corrections
            : [],
          vocab_notes: Array.isArray(parsedFeedback.vocab_notes)
            ? parsedFeedback.vocab_notes
            : [],
          difficulty_signal: parsedFeedback.difficulty_signal || "on_track",
          awaiting_correction: parsedFeedback.awaiting_correction || false,
        };
        if (
          Array.isArray(parsed.reply_lines) &&
          parsed.reply_lines.length > 0
        ) {
          replyLines = parsed.reply_lines;
          parsedTail = true;
        }
      }
    } catch {
      // Keep the graceful-degradation defaults above; recovered below.
    }
  }

  // The model dropped the ===FEEDBACK=== JSON tail (common with gpt-4o, which
  // often ends its turn after the reply). Recover per-sentence translations and
  // feedback with one reliable structured call so hover-to-translate shows real
  // English and corrections/vocab aren't silently lost.
  if (!parsedTail && reply) {
    try {
      const annotated = await annotateStreamedReply(
        language,
        difficulty,
        mode,
        history,
        userMessage,
        reply,
      );
      if (annotated.reply_lines.length > 0) {
        replyLines = annotated.reply_lines;
        feedback = annotated.feedback;
        parsedTail = true;
      }
    } catch {
      // Annotation failed too — fall back to untranslated lines below so the
      // turn still succeeds (the reply is already on the student's screen).
    }
  }

  // If the model led straight into the delimiter without a plain-text reply (no
  // deltas were streamed), reconstruct the reply from reply_lines so the turn
  // still succeeds instead of persisting a blank bubble.
  if (!reply && replyLines.length > 0) {
    reply = replyLines.map((l) => l.es).join(" ").trim();
  }

  // Truly empty output (nothing streamed and no usable JSON) — fail the turn so
  // the route rolls back rather than leaving a blank tutor bubble.
  if (!reply) {
    throw new TutorResponseError();
  }
  if (replyLines.length === 0) {
    replyLines = [{ es: reply, en: reply }];
  }

  const tutorResponse: TutorResponse = {
    reply,
    reply_lines: replyLines,
    feedback,
  };

  yield { type: "final", tutorResponse };
}
