export interface UserLanguageProfile {
  id: string;
  userId: string;
  language: string;
  currentLevel: string;
  voiceSecondsUsedToday: number;
  lastResetAt: string;
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
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
  feedback?: MessageFeedback | null;
}

export interface MessageFeedback {
  id: string;
  messageId: string;
  corrections: unknown;
  vocabNotes: unknown;
}

export interface VocabularyItem {
  id: string;
  userId: string;
  language: string;
  word: string;
  definition: string;
  exampleSentence: string | null;
  timesSeen: number;
  timesCorrect: number;
  easeFactor: number;
  nextReviewAt: string;
  createdAt: string;
}
