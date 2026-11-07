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
  durationMinutes?: number;
  messages?: Message[];
  _count?: { messages: number };
}

export interface ReplyLine {
  es: string;
  en: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
  feedback?: MessageFeedback | null;
  replyLines?: ReplyLine[];
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
  difficulty_signal?: "too_easy" | "on_track" | "too_hard";
}

export function createSession(data: {
  language: string;
  difficulty: string;
  mode: string;
}): Promise<Session & { messages?: Message[] }> {
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

/**
 * Streaming variant of {@link sendMessage} (#20). Sends the message over SSE and
 * invokes `onDelta` with each chunk of Sofía's visible reply as it arrives, then
 * resolves with the same payload shape as {@link sendMessage} once the server
 * emits its `complete` event. Rejects on `error` events, non-OK responses
 * (401/404/429), or a stream that ends without completing.
 */
export async function sendMessageStream(
  sessionId: string,
  content: string,
  onDelta: (text: string) => void,
): Promise<SendMessageResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ content }),
  });

  // Non-OK (401/404/429/...) — parse the JSON error body like request() does.
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: SendMessageResponse | null = null;
  let streamError: Error | null = null;

  // Each SSE frame is a group of `event:`/`data:` lines terminated by a blank
  // line. Frames can be split across network chunks, so we buffer until `\n\n`.
  const handleFrame = (frame: string) => {
    let event = "";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!event) return;

    if (event === "delta") {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed.text === "string") onDelta(parsed.text);
      } catch {
        // Ignore a malformed delta rather than aborting the whole stream.
      }
    } else if (event === "complete") {
      result = JSON.parse(data) as SendMessageResponse;
    } else if (event === "error") {
      let message = "Something went wrong";
      try {
        message = JSON.parse(data).error || message;
      } catch {
        // keep the generic message
      }
      streamError = new Error(message);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (frame.trim()) handleFrame(frame);
    }
  }
  // Flush any trailing frame that wasn't newline-terminated.
  buffer += decoder.decode();
  if (buffer.trim()) handleFrame(buffer);

  if (streamError) throw streamError;
  if (result) return result;
  throw new Error(
    "Sofia couldn't respond just now. Please try sending your message again.",
  );
}

// endedAt is used to calculate session duration for progress stats (total_minutes, streaks)
export function endSession(sessionId: string): Promise<Session> {
  return request(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ endedAt: new Date().toISOString() }),
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
  const tzOffset = new Date().getTimezoneOffset();
  return request(`/progress?language=${language}&tzOffset=${tzOffset}`);
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
    // «» only mark Spanish words for on-screen color, so the voice skips them.
    body: JSON.stringify({ text: text.replace(/[«»]/g, ""), language }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Synthesize failed: ${res.status}`);
  }
  return res.blob();
}

// --- Language profile (persisted CEFR level) ---

export interface LanguageProfile {
  id?: string;
  userId?: string;
  language: string;
  currentLevel: string;
}

export function getProfile(language = "es"): Promise<LanguageProfile> {
  return request(`/profile?language=${language}`);
}

export function updateProfileLevel(
  language: string,
  currentLevel: string,
): Promise<LanguageProfile> {
  return request("/profile", {
    method: "PATCH",
    body: JSON.stringify({ language, currentLevel }),
  });
}
