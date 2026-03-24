import OpenAI from "openai";
import { prisma } from "../db.js";
import { env } from "../env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface SessionSummary {
  topics: string[];
  mistakes: string[];
  newVocab: string[];
  encouragement: string;
}

export interface VocabStats {
  total_words: number;
  words_mastered: number;
  avg_difficulty: number;
  top_mistakes: string[];
}

export interface ProgressStats {
  sessions_count: number;
  total_minutes: number;
  streak_days: number;
  level_history: Array<{ date: string; level: string }>;
  vocab_growth: Array<{ date: string; count: number }>;
}

export async function getSessionSummary(
  sessionId: string,
): Promise<SessionSummary> {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  if (messages.length === 0) {
    return {
      topics: [],
      mistakes: [],
      newVocab: [],
      encouragement: "Start a conversation to get a summary!",
    };
  }

  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: `Analyze this language learning conversation and return a JSON summary with these fields:
- "topics": array of 1-5 topic strings discussed (e.g. "greetings", "food vocabulary")
- "mistakes": array of strings describing key grammar/vocabulary mistakes the learner made
- "newVocab": array of new Spanish words/phrases introduced
- "encouragement": a short encouraging message about the learner's progress

Return valid JSON only.`,
      },
      { role: "user", content: conversationText },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return {
      topics: [],
      mistakes: [],
      newVocab: [],
      encouragement: "Great session! Keep practicing!",
    };
  }

  const parsed = JSON.parse(raw);
  return {
    topics: parsed.topics || [],
    mistakes: parsed.mistakes || [],
    newVocab: parsed.newVocab || [],
    encouragement: parsed.encouragement || "Great session! Keep practicing!",
  };
}

export async function getVocabDueForReview(userId: string, language: string) {
  return prisma.vocabularyItem.findMany({
    where: {
      userId,
      language,
      nextReviewAt: { lte: new Date() },
    },
    orderBy: { nextReviewAt: "asc" },
    take: 20,
  });
}

export async function getVocabStats(
  userId: string,
  language: string,
): Promise<VocabStats> {
  const allVocab = await prisma.vocabularyItem.findMany({
    where: { userId, language },
    select: {
      word: true,
      timesCorrect: true,
      timesSeen: true,
      easeFactor: true,
    },
  });

  const total_words = allVocab.length;
  const words_mastered = allVocab.filter((v) => v.timesCorrect >= 3).length;
  const avg_difficulty =
    total_words > 0
      ? allVocab.reduce((sum, v) => sum + v.easeFactor, 0) / total_words
      : 0;
  const top_mistakes = allVocab
    .filter((v) => v.timesCorrect === 0 && v.timesSeen > 1)
    .map((v) => v.word);

  return { total_words, words_mastered, avg_difficulty, top_mistakes };
}

export async function getProgressStats(
  userId: string,
  language: string,
): Promise<ProgressStats> {
  const sessions = await prisma.session.findMany({
    where: { userId, language },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, endedAt: true, difficulty: true },
  });

  const sessions_count = sessions.length;

  const now = new Date();
  const total_minutes = sessions.reduce((sum, s) => {
    const end = s.endedAt || now;
    return sum + (end.getTime() - s.createdAt.getTime()) / 60000;
  }, 0);

  // Streak: consecutive days ending today with at least 1 session
  const sessionDays = new Set(
    sessions.map((s) => s.createdAt.toISOString().slice(0, 10)),
  );
  let streak_days = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (sessionDays.has(key)) {
      streak_days++;
    } else {
      break;
    }
  }

  const level_history = sessions.map((s) => ({
    date: s.createdAt.toISOString(),
    level: s.difficulty,
  }));

  // Vocab growth: cumulative count by day
  const vocabItems = await prisma.vocabularyItem.findMany({
    where: { userId, language },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const dailyCounts = new Map<string, number>();
  for (const v of vocabItems) {
    const day = v.createdAt.toISOString().slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  }

  const vocab_growth: Array<{ date: string; count: number }> = [];
  let cumulative = 0;
  for (const [date, count] of [...dailyCounts.entries()].sort()) {
    cumulative += count;
    vocab_growth.push({ date, count: cumulative });
  }

  return {
    sessions_count,
    total_minutes: Math.round(total_minutes),
    streak_days,
    level_history,
    vocab_growth,
  };
}

export async function updateVocabAfterReview(
  itemId: string,
  wasCorrect: boolean,
) {
  const item = await prisma.vocabularyItem.findUnique({
    where: { id: itemId },
  });
  if (!item) throw new Error("Vocabulary item not found");

  const newEaseFactor = wasCorrect
    ? Math.max(1.3, item.easeFactor + 0.1)
    : Math.max(1.3, item.easeFactor - 0.2);

  const daysUntilReview = wasCorrect
    ? (item.timesSeen + 1) * newEaseFactor
    : 1;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + daysUntilReview);

  return prisma.vocabularyItem.update({
    where: { id: itemId },
    data: {
      easeFactor: newEaseFactor,
      nextReviewAt,
      timesSeen: { increment: 1 },
      ...(wasCorrect ? { timesCorrect: { increment: 1 } } : {}),
    },
  });
}
