import { apiClient } from "./client.js";
import type { Session, SendMessageResponse } from "../types/index.js";

export async function createSession(data: {
  language: string;
  difficulty: string;
  mode: string;
}): Promise<Session> {
  const res = await apiClient.post<Session>("/sessions", data);
  return res.data;
}

export async function getSessions(): Promise<Session[]> {
  const res = await apiClient.get<Session[]>("/sessions");
  return res.data;
}

export async function getSession(id: string): Promise<Session> {
  const res = await apiClient.get<Session>(`/sessions/${id}`);
  return res.data;
}

export async function sendMessage(
  sessionId: string,
  content: string,
): Promise<SendMessageResponse> {
  const res = await apiClient.post<SendMessageResponse>(
    `/sessions/${sessionId}/messages`,
    { content },
  );
  return res.data;
}
