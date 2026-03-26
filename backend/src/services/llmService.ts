import OpenAI from "openai";
import { env } from "../env.js";
import { getVocabDueForReview } from "./progressService.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

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
): Promise<string> {
  const difficultyGuide =
    DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];
  const modeInstruction =
    mode === "immersion"
      ? "IMMERSION MODE: Respond ONLY in Spanish. Never use English, even if the user writes in English. If the user is struggling, rephrase in simpler Spanish instead of switching to English."
      : "HELPER MODE: Respond primarily in Spanish, but you may switch to English to explain grammar, clarify meaning, or help when the user is stuck. Include reply_translation in your JSON response.";

  const base = `You are Sofia, a warm and encouraging ${language === "es" ? "Spanish" : language} language tutor. You are patient, friendly, and adapt to the student's level.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuide}

${modeInstruction}

CORRECTION APPROACH (CRITICAL — follow this strictly):
- When the student makes errors, FIRST acknowledge what they tried to say, then clearly show the correction.
- After correcting, ask the student to rephrase or repeat the corrected form BEFORE moving to new content.
- Use a format like: "¡Casi! You said '[incorrect]', but it should be '[correct]' because [reason]. Can you try saying it again?"
- Only move to new questions or topics AFTER the student demonstrates understanding of the correction.
- If the student's retry still has errors, gently correct again but simplify your explanation.
- When the student successfully corrects themselves, be extra encouraging: "¡Perfecto! That's exactly right!"
- Set "awaiting_correction" to true in your response when you've asked the student to retry a correction.
- Set "awaiting_correction" to false when the student has successfully corrected themselves or when there are no corrections needed.

You MUST respond with valid JSON matching this exact schema (no markdown fences, no extra text):
{
  "reply": "Your full conversational response in Spanish",
  "reply_lines": [
    { "es": "Each sentence of your Spanish reply", "en": "Its English translation" },
    { "es": "Another sentence in Spanish", "en": "Its English translation" }
  ],
  "feedback": {
    "corrections": [
      {
        "original": "what the user wrote incorrectly",
        "corrected": "the correct form",
        "explanation": "brief explanation in English"
      }
    ],
    "vocab_notes": [
      {
        "word": "a Spanish word used in your reply or the user's message",
        "definition": "English definition",
        "example": "example sentence using the word",
        "category": "one of: greetings, food, travel, numbers, family, work, nature, emotions, shopping, health, general"
      }
    ],
    "difficulty_signal": "too_easy" | "on_track" | "too_hard",
    "awaiting_correction": false
  }
}

IMPORTANT: "reply_lines" must break your reply into individual sentences, each with the Spanish text ("es") and its English translation ("en"). Every sentence in "reply" must appear in "reply_lines".

Guidelines:
- Keep corrections helpful, not overwhelming. Focus on the most important errors.
- Include 1-3 vocab notes per response highlighting useful words, always with a category.
- Set difficulty_signal based on how well the student is performing at the current level.
- If the user writes in English, gently encourage them to try in Spanish.
- Be conversational and natural. Ask follow-up questions to keep the conversation going.
- If there are no errors to correct, return an empty corrections array and set awaiting_correction to false.`;

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
        max_tokens: 1024,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty response from OpenAI");

      const parsed: TutorResponse = JSON.parse(raw);

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
    } catch (err) {
      if (attempt === 1) {
        // Graceful fallback: return raw text with empty feedback
        const fallbackReply =
          err instanceof Error
            ? `Lo siento, hubo un problema. (Error: ${err.message})`
            : "Lo siento, hubo un problema técnico.";
        return {
          reply: fallbackReply,
          reply_lines: [{ es: fallbackReply, en: "Sorry, there was a problem." }],
          feedback: {
            corrections: [],
            vocab_notes: [],
            difficulty_signal: "on_track",
            awaiting_correction: false,
          },
        };
      }
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unexpected error in getTutorResponse");
}
