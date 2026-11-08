import OpenAI from "openai";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { MODELS, chatParams } from "./aiModels.js";
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

// Cap applied to endedAt so a session left open in a tab (ended long after the
// last message) can't inflate its duration beyond the actual conversation.
const ENDED_AT_GRACE_MS = 5 * 60 * 1000;

/**
 * Derive a session's duration from message activity rather than wall clock.
 *
 * - Sessions with no messages contribute 0 (lastMessageAt is null).
 * - When endedAt is present, use it but cap it at lastMessageAt + 5 minutes to
 *   bound tab-left-open inflation.
 * - When endedAt is absent, use lastMessageAt as the end.
 * - Never returns a negative duration.
 */
export function sessionDurationMs(
  createdAt: Date,
  endedAt: Date | null,
  lastMessageAt: Date | null,
): number {
  if (!lastMessageAt) return 0;

  const activityEnd = lastMessageAt.getTime();
  const end = endedAt
    ? Math.min(endedAt.getTime(), activityEnd + ENDED_AT_GRACE_MS)
    : activityEnd;

  return Math.max(0, end - createdAt.getTime());
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
    ...chatParams(MODELS.fast, { temperature: 0.5, maxTokens: 512 }),
    response_format: { type: "json_object" },
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
      lapses: true,
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
    .filter((v) => v.lapses >= 1 || v.state === State.Relearning)
    .sort((a, b) => b.lapses - a.lapses || a.stability - b.stability)
    .slice(0, 10)
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
  tzOffsetMinutes = 0,
): Promise<ProgressStats> {
  // Local day key (YYYY-MM-DD) for a given instant, shifted by the client's
  // timezone offset (JS getTimezoneOffset() convention: UTC minus local).
  const dayKey = (t: Date): string =>
    new Date(t.getTime() - tzOffsetMinutes * 60000).toISOString().slice(0, 10);

  const sessions = await prisma.session.findMany({
    where: { userId, language },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      endedAt: true,
      difficulty: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const sessions_count = sessions.length;

  const total_minutes = sessions.reduce((sum, s) => {
    const lastMessageAt = s.messages[0]?.createdAt ?? null;
    return sum + sessionDurationMs(s.createdAt, s.endedAt, lastMessageAt) / 60000;
  }, 0);

  // Streak: consecutive days ending today with at least 1 session
  const sessionDays = new Set(sessions.map((s) => dayKey(s.createdAt)));
  let streak_days = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = dayKey(d);
    if (sessionDays.has(key)) {
      streak_days++;
    } else {
      break;
    }
  }

  // Collapse consecutive same-level sessions: keep the first session and only
  // subsequent sessions where the level changed from the previous one.
  const level_history: Array<{ date: string; level: string }> = [];
  let prevLevel: string | null = null;
  for (const s of sessions) {
    if (s.difficulty !== prevLevel) {
      level_history.push({ date: s.createdAt.toISOString(), level: s.difficulty });
      prevLevel = s.difficulty;
    }
  }

  // Vocab growth: cumulative count by day
  const vocabItems = await prisma.vocabularyItem.findMany({
    where: { userId, language },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const dailyCounts = new Map<string, number>();
  for (const v of vocabItems) {
    const day = dayKey(v.createdAt);
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
  userId: string,
) {
  const item = await prisma.vocabularyItem.findFirst({
    where: { id: itemId, userId },
  });
  if (!item) return null;

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
  userId: string,
) {
  return reviewVocabFSRS(itemId, booleanToRating(wasCorrect), userId);
}
