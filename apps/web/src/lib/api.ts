import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface Session {
  id: string;
  userId: string;
  language: string;
  difficulty: string;
  mode: string;
  createdAt: string;
  endedAt: string | null;
  messages?: Message[];
  _count?: { messages: number };
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
  feedback?: MessageFeedback | null;
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabNote {
  word: string;
  definition: string;
  example: string;
  category?: string;
}

export interface MessageFeedback {
  id: string;
  messageId: string;
  corrections: Correction[];
  vocabNotes: VocabNote[];
  awaitingCorrection?: boolean;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
  feedback: MessageFeedback | null;
}

export function createSession(data: {
  language: string;
  difficulty: string;
  mode: string;
}): Promise<Session> {
  return request("/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getSessions(): Promise<Session[]> {
  return request("/sessions");
}

export function getSession(id: string): Promise<Session> {
  return request(`/sessions/${id}`);
}

export function sendMessage(
  sessionId: string,
  content: string,
): Promise<SendMessageResponse> {
  return request(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function transcribeAudio(
  audioBlob: Blob,
  language: string,
): Promise<{ transcript: string }> {
  const headers = await getAuthHeaders();
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  form.append("language", language);

  const res = await fetch(`${API_URL}/audio/transcribe`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Transcribe failed: ${res.status}`);
  }
  return res.json();
}

// --- Progress & Vocabulary types ---

export interface SessionSummary {
  topics: string[];
  mistakes: string[];
  newVocab: string[];
  encouragement: string;
}

export interface VocabularyItem {
  id: string;
  userId: string;
  language: string;
  word: string;
  definition: string;
  exampleSentence: string | null;
  category: string;
  sessionId: string | null;
  // FSRS fields
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  lastReviewAt: string | null;
  nextReviewAt: string;
  createdAt: string;
  // Legacy
  timesSeen: number;
  timesCorrect: number;
  easeFactor: number;
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

export function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  return request(`/sessions/${sessionId}/summary`);
}

export function getVocabulary(language = "es"): Promise<VocabularyItem[]> {
  return request(`/vocabulary?language=${language}`);
}

export function getVocabStats(language = "es"): Promise<VocabStats> {
  return request(`/vocabulary/stats?language=${language}`);
}

export function getProgress(language = "es"): Promise<ProgressStats> {
  return request(`/progress?language=${language}`);
}

export function reviewVocab(
  itemId: string,
  rating: number,
): Promise<VocabularyItem> {
  return request(`/vocabulary/${itemId}/review`, {
    method: "PUT",
    body: JSON.stringify({ rating }),
  });
}

export function getAllVocabulary(
  language = "es",
  options?: { category?: string; state?: number; sort?: string },
): Promise<VocabularyItem[]> {
  const params = new URLSearchParams({ language });
  if (options?.category) params.set("category", options.category);
  if (options?.state !== undefined) params.set("state", String(options.state));
  if (options?.sort) params.set("sort", options.sort);
  return request(`/vocabulary/all?${params}`);
}

export async function synthesizeSpeech(
  text: string,
  language: string,
): Promise<Blob> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/audio/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Synthesize failed: ${res.status}`);
  }
  return res.blob();
}
