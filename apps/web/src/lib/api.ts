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
}

export interface MessageFeedback {
  id: string;
  messageId: string;
  corrections: Correction[];
  vocabNotes: VocabNote[];
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
