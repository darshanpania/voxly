import { prisma } from "../db.js";
import type { TutorResponse } from "./llmService.js";
import { normalizeWord } from "./wordNormalizer.js";

export async function saveFeedbackAndVocab(
  messageId: string,
  userId: string,
  language: string,
  tutorResponse: TutorResponse,
  sessionId?: string,
): Promise<void> {
  const { corrections, vocab_notes } = tutorResponse.feedback;

  // Save MessageFeedback
  await prisma.messageFeedback.create({
    data: {
      messageId,
      corrections: corrections as any,
      vocabNotes: vocab_notes as any,
    },
  });

  // Upsert vocabulary items
  for (const vocab of vocab_notes) {
    // Normalize the word so casing, articles, and punctuation don't create
    // duplicate cards keyed on (userId, language, word).
    const word = normalizeWord(vocab.word ?? "", language);
    if (!word) continue;

    await prisma.vocabularyItem.upsert({
      where: {
        userId_language_word: {
          userId,
          language,
          word,
        },
      },
      update: {
        timesSeen: { increment: 1 },
        definition: vocab.definition,
        exampleSentence: vocab.example,
        category: vocab.category || "general",
      },
      create: {
        userId,
        language,
        word,
        definition: vocab.definition,
        exampleSentence: vocab.example,
        category: vocab.category || "general",
        sessionId: sessionId || null,
      },
    });
  }
}
