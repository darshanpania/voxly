export interface UserLanguageProfile {
  id: string;
  userId: string;
  language: string;
  currentLevel: string;
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
