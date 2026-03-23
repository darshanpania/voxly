import OpenAI from "openai";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TutorResponse {
  reply: string;
  reply_translation?: string;
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
    }>;
    difficulty_signal: "too_easy" | "on_track" | "too_hard";
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

function buildSystemPrompt(
  language: string,
  difficulty: string,
  mode: string,
): string {
  const difficultyGuide =
    DIFFICULTY_GUIDES[difficulty] || DIFFICULTY_GUIDES["A1"];
  const modeInstruction =
    mode === "immersion"
      ? "IMMERSION MODE: Respond ONLY in Spanish. Never use English, even if the user writes in English. If the user is struggling, rephrase in simpler Spanish instead of switching to English."
      : "HELPER MODE: Respond primarily in Spanish, but you may switch to English to explain grammar, clarify meaning, or help when the user is stuck. Include reply_translation in your JSON response.";

  return `You are Sofia, a warm and encouraging ${language === "es" ? "Spanish" : language} language tutor. You are patient, friendly, and adapt to the student's level.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuide}

${modeInstruction}

You MUST respond with valid JSON matching this exact schema (no markdown fences, no extra text):
{
  "reply": "Your conversational response in Spanish",
  ${mode === "helper" ? '"reply_translation": "English translation of your reply",' : ""}
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
        "example": "example sentence using the word"
      }
    ],
    "difficulty_signal": "too_easy" | "on_track" | "too_hard"
  }
}

Guidelines:
- Keep corrections helpful, not overwhelming. Focus on the most important errors.
- Include 1-3 vocab notes per response highlighting useful words.
- Set difficulty_signal based on how well the student is performing at the current level.
- If the user writes in English, gently encourage them to try in Spanish.
- Be conversational and natural. Ask follow-up questions to keep the conversation going.
- If there are no errors to correct, return an empty corrections array.`;
}

export async function getTutorResponse(
  language: string,
  difficulty: string,
  mode: string,
  history: ConversationMessage[],
  userMessage: string,
): Promise<TutorResponse> {
  const systemPrompt = buildSystemPrompt(language, difficulty, mode);

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

      return parsed;
    } catch (err) {
      if (attempt === 1) {
        // Graceful fallback: return raw text with empty feedback
        return {
          reply:
            err instanceof Error
              ? `Lo siento, hubo un problema. (Error: ${err.message})`
              : "Lo siento, hubo un problema técnico.",
          feedback: {
            corrections: [],
            vocab_notes: [],
            difficulty_signal: "on_track",
          },
        };
      }
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Unexpected error in getTutorResponse");
}
