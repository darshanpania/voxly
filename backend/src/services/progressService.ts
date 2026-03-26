import OpenAI from "openai";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { schedule, booleanToRating, State, type FSRSCard, type Rating } from "./fsrs.js";

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
  by_state: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
  };
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
  // Check cache first
  const cached = await prisma.sessionSummary.findUnique({
    where: { sessionId },
  });
  if (cached) {
    return {
      topics: cached.topics as string[],
      mistakes: cached.mistakes as string[],
      newVocab: cached.newVocab as string[],
      encouragement: cached.encouragement,
    };
  }

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
  let result: SessionSummary;

  if (!raw) {
    result = {
      topics: [],
      mistakes: [],
      newVocab: [],
      encouragement: "Great session! Keep practicing!",
    };
  } else {
    const parsed = JSON.parse(raw);
    result = {
      topics: parsed.topics || [],
      mistakes: parsed.mistakes || [],
      newVocab: parsed.newVocab || [],
      encouragement: parsed.encouragement || "Great session! Keep practicing!",
    };
  }

  // Cache the summary
  try {
    await prisma.sessionSummary.create({
      data: {
        sessionId,
        topics: result.topics as any,
        mistakes: result.mistakes as any,
        newVocab: result.newVocab as any,
        encouragement: result.encouragement,
      },
    });
  } catch {
    // Ignore duplicate key errors (race condition)
  }

  return result;
}

export async function getVocabDueForReview(userId: string, language: string) {
  return prisma.vocabularyItem.findMany({
    where: {
      userId,
      language,
      OR: [
        { state: State.New },
        { nextReviewAt: { lte: new Date() } },
      ],
    },
    orderBy: [
      { state: "asc" }, // New items first
      { nextReviewAt: "asc" },
    ],
    take: 20,
  });
}

export async function getAllVocabulary(
  userId: string,
  language: string,
  options?: {
    category?: string;
    state?: number;
    sort?: string;
  },
) {
  const where: any = { userId, language };
  if (options?.category && options.category !== "all") {
    where.category = options.category;
  }
  if (options?.state !== undefined && options.state >= 0) {
    where.state = options.state;
  }

  const orderBy: any =
    options?.sort === "word"
      ? { word: "asc" }
      : options?.sort === "stability"
        ? { stability: "desc" }
        : options?.sort === "created"
          ? { createdAt: "desc" }
          : { nextReviewAt: "asc" };

  return prisma.vocabularyItem.findMany({
    where,
    orderBy,
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
      state: true,
      stability: true,
      difficulty: true,
    },
  });

  const total_words = allVocab.length;
  const words_mastered = allVocab.filter(
    (v) => v.state === State.Review && v.stability > 21,
  ).length;
  const avg_difficulty =
    total_words > 0
      ? allVocab.reduce((sum, v) => sum + v.difficulty, 0) / total_words
      : 0;
  const top_mistakes = allVocab
    .filter((v) => v.timesCorrect === 0 && v.timesSeen > 1)
    .map((v) => v.word);

  const by_state = {
    new: allVocab.filter((v) => v.state === State.New).length,
    learning: allVocab.filter((v) => v.state === State.Learning).length,
    review: allVocab.filter((v) => v.state === State.Review).length,
    relearning: allVocab.filter((v) => v.state === State.Relearning).length,
  };

  return { total_words, words_mastered, avg_difficulty, top_mistakes, by_state };
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

/**
 * Review a vocabulary item using FSRS scheduling.
 */
export async function reviewVocabFSRS(
  itemId: string,
  rating: Rating,
) {
  const item = await prisma.vocabularyItem.findUnique({
    where: { id: itemId },
  });
  if (!item) throw new Error("Vocabulary item not found");

  const card: FSRSCard = {
    stability: item.stability,
    difficulty: item.difficulty,
    elapsedDays: item.elapsedDays,
    scheduledDays: item.scheduledDays,
    reps: item.reps,
    lapses: item.lapses,
    state: item.state as any,
    lastReviewAt: item.lastReviewAt,
  };

  const now = new Date();
  const result = schedule(card, rating, now);

  const wasCorrect = rating >= 3; // Good or Easy

  return prisma.vocabularyItem.update({
    where: { id: itemId },
    data: {
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsedDays: result.card.elapsedDays,
      scheduledDays: result.card.scheduledDays,
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: result.card.state,
      lastReviewAt: result.card.lastReviewAt,
      nextReviewAt: result.nextReviewAt,
      // Legacy fields
      timesSeen: { increment: 1 },
      ...(wasCorrect ? { timesCorrect: { increment: 1 } } : {}),
    },
  });
}

/**
 * Legacy wrapper: accept boolean and convert to FSRS rating.
 */
export async function updateVocabAfterReview(
  itemId: string,
  wasCorrect: boolean,
) {
  return reviewVocabFSRS(itemId, booleanToRating(wasCorrect));
}
