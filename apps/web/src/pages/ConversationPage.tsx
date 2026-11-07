import { useState, useRef, useEffect, useCallback } from "react";
import { Ear, EarOff } from "lucide-react";
import { SessionHeader } from "../components/SessionHeader";
import { MessageBubble } from "../components/MessageBubble";
import { VoiceButton } from "../components/VoiceButton";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { useTTS, type PlayResult } from "../hooks/useTTS";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Message } from "../lib/api";
import * as api from "../lib/api";
import { Button } from "@/components/ui/button";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LANGUAGE = "es";
const ACTIVE_SESSION_KEY = "voxly:activeSession";
const HANDS_FREE_KEY = "voxly:handsFree";

function loadHandsFree(): boolean {
  try {
    return localStorage.getItem(HANDS_FREE_KEY) !== "off";
  } catch {
    return true;
  }
}

// Temp ids for the optimistic bubbles shown while a reply streams in (#20).
const PENDING_USER_ID = "pending-user";
const PENDING_ASSISTANT_ID = "pending-assistant";

export function ConversationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [difficulty, setDifficulty] = useState("A1");
  const [mode, setMode] = useState("helper");
  const [showFeedback, setShowFeedback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [levelBanner, setLevelBanner] = useState<{ direction: "up" | "down"; targetLevel: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<{ type: "level" | "mode"; value: string } | null>(null);
  const consecutiveSignalRef = useRef<{ signal: string; count: number }>({ signal: "", count: 0 });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();
  // Hands-free: after Sofía finishes speaking, start listening again on our own.
  const [handsFree, setHandsFree] = useState(loadHandsFree);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const sessionEndedRef = useRef(sessionEnded);
  sessionEndedRef.current = sessionEnded;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Session bootstrap: resume an active session, else eagerly create one so
  // Sofía greets first (#9, #16). Guarded against StrictMode double-invocation.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void initConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initConversation() {
    setInitializing(true);

    // 1. Attempt to resume the last active, unfinished session (#9).
    const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (savedId) {
      try {
        const session = await api.getSession(savedId);
        if (session && !session.endedAt) {
          setSessionId(session.id);
          setDifficulty(session.difficulty);
          setMode(session.mode);
          setMessages(session.messages ?? []);
          setInitializing(false);
          return;
        }
      } catch {
        // fall through to a fresh session
      }
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }

    // 2. Initialize the level from the persisted profile (#8).
    let level = "A1";
    try {
      const profile = await api.getProfile(LANGUAGE);
      level = profile.currentLevel || "A1";
    } catch {
      // keep the A1 default on failure
    }
    setDifficulty(level);

    // 3. Eagerly create a session so Sofía speaks first (#16).
    await startSession(level, mode);
  }

  // Create a fresh session and load its canned greeting into the view (#16).
  async function startSession(level: string, sessionMode: string) {
    setInitializing(true);
    setError(null);
    try {
      const session = await api.createSession({
        language: LANGUAGE,
        difficulty: level,
        mode: sessionMode,
      });
      setSessionId(session.id);
      setMessages(session.messages ?? []);
      localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
      const greeting = session.messages?.[0];
      if (greeting) void speakThenListen(greeting.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInitializing(false);
    }
  }

  function resetConversationState() {
    setMessages([]);
    setError(null);
    setSessionEnded(false);
    setLevelBanner(null);
    setPendingChange(null);
    consecutiveSignalRef.current = { signal: "", count: 0 };
    clearTimeout(bannerTimerRef.current);
  }

  // Reuse the already-created session; only create as a fallback (#16).
  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const session = await api.createSession({
      language: LANGUAGE,
      difficulty,
      mode,
    });
    setSessionId(session.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    if (session.messages && session.messages.length > 0) {
      setMessages((prev) => [...session.messages!, ...prev]);
    }
    return session.id;
  };

  // Speak Sofía's line, then (hands-free) open the mic for the learner's turn.
  // Muted counts as "done speaking" so a hands-free reader can still answer.
  async function speakThenListen(text: string) {
    const result: PlayResult = await tts.play(text);
    if (
      (result === "ended" || result === "muted") &&
      handsFreeRef.current &&
      !sessionEndedRef.current
    ) {
      void voice.start();
    }
  }

  // Voice-only: every turn is a transcript, sent as soon as it arrives.
  const handleSend = async (spoken: string) => {
    const text = spoken.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);

    try {
      const sid = await ensureSession();

      // Show optimistic bubbles immediately: the user's message and an empty
      // assistant bubble that fills in as tokens stream (#20).
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: PENDING_USER_ID, sessionId: sid, role: "user", content: text, createdAt: now },
        { id: PENDING_ASSISTANT_ID, sessionId: sid, role: "assistant", content: "", createdAt: now },
      ]);

      const res = await api.sendMessageStream(sid, text, (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === PENDING_ASSISTANT_ID
              ? { ...m, content: m.content + delta }
              : m,
          ),
        );
      });

      // Swap both temp bubbles for the persisted messages in one update.
      setMessages((prev) => [
        ...prev.filter(
          (m) => m.id !== PENDING_USER_ID && m.id !== PENDING_ASSISTANT_ID,
        ),
        res.userMessage,
        { ...res.assistantMessage, feedback: res.feedback, replyLines: res.assistantMessage.replyLines },
      ]);

      // Track consecutive difficulty signals for level-up/down suggestions
      const signal = res.difficulty_signal;
      if (signal && signal !== "on_track") {
        const prev = consecutiveSignalRef.current;
        if (prev.signal === signal) {
          prev.count += 1;
        } else {
          consecutiveSignalRef.current = { signal, count: 1 };
        }

        const { count } = consecutiveSignalRef.current;
        if (count >= 3 && !res.feedback?.awaitingCorrection) {
          const currentIdx = CEFR_LEVELS.indexOf(difficulty);
          if (signal === "too_easy" && currentIdx < CEFR_LEVELS.length - 1) {
            setLevelBanner({ direction: "up", targetLevel: CEFR_LEVELS[currentIdx + 1] });
          } else if (signal === "too_hard" && currentIdx > 0) {
            setLevelBanner({ direction: "down", targetLevel: CEFR_LEVELS[currentIdx - 1] });
          }
          // Auto-dismiss after 30 seconds
          clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setLevelBanner(null), 30_000);
        }
      } else {
        consecutiveSignalRef.current = { signal: "", count: 0 };
      }

      // Speak the reply, then hand the turn back to the learner.
      void speakThenListen(res.assistantMessage.content);
    } catch (err) {
      // Drop the optimistic bubbles; the learner can simply say it again.
      setMessages((prev) =>
        prev.filter(
          (m) => m.id !== PENDING_USER_ID && m.id !== PENDING_ASSISTANT_ID,
        ),
      );
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // The app is voice-only, so a transcript is sent straight away. Sofía is
  // told the text is speech-to-text and to allow for recognition errors.
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const handleTranscript = useCallback((transcript: string) => {
    void handleSendRef.current(transcript);
  }, []);

  const voice = useVoiceRecorder({
    language: LANGUAGE,
    onTranscript: handleTranscript,
    onError: setError,
  });

  // Tapping the mic while Sofía talks cuts her off and starts listening.
  const handleTalk = () => {
    setError(null);
    tts.stop();
    void voice.start();
  };

  const toggleHandsFree = () => {
    setHandsFree((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HANDS_FREE_KEY, next ? "on" : "off");
      } catch {
        // Non-critical preference.
      }
      if (!next) voice.cancel();
      return next;
    });
  };

  const handleEndSession = async () => {
    voice.cancel();
    tts.stop();
    if (sessionId) {
      api.endSession(sessionId).catch(() => {});
      setSessionEnded(true);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  };

  const handleNewSession = async () => {
    voice.cancel();
    tts.stop();
    resetConversationState();
    setSessionId(null);
    await startSession(difficulty, mode);
  };

  // Apply a level/mode change: close the old session, persist level, and start
  // fresh with the new settings (#8, #17). Assumes any needed confirmation has
  // already been obtained.
  async function applyChange(type: "level" | "mode", value: string) {
    const oldSessionId = sessionId;
    const newLevel = type === "level" ? value : difficulty;
    const newMode = type === "mode" ? value : mode;

    voice.cancel();
    tts.stop();

    // Close the abandoned session server-side so empty sessions don't linger.
    if (oldSessionId) {
      api.endSession(oldSessionId).catch(() => {});
    }

    if (type === "level") {
      setDifficulty(value);
      // Level is persisted only via the profile now (#8).
      api.updateProfileLevel(LANGUAGE, value).catch(() => {});
    } else {
      setMode(value);
    }

    resetConversationState();
    setSessionId(null);
    await startSession(newLevel, newMode);
  }

  const hasUserMessage = messages.some((m) => m.role === "user");

  // Level/mode change destroys the current conversation — confirm first if the
  // learner has actually said something (#17).
  const requestChange = (type: "level" | "mode", value: string) => {
    if (type === "level" && value === difficulty) return;
    if (type === "mode" && value === mode) return;
    if (hasUserMessage) {
      setPendingChange({ type, value });
      return;
    }
    void applyChange(type, value);
  };

  const handleDifficultyChange = (d: string) => requestChange("level", d);
  const handleModeChange = (m: string) => requestChange("mode", m);

  const confirmPendingChange = () => {
    if (!pendingChange) return;
    const { type, value } = pendingChange;
    setPendingChange(null);
    void applyChange(type, value);
  };

  const cancelPendingChange = () => setPendingChange(null);

  const handleLevelBannerConfirm = () => {
    if (levelBanner) {
      const target = levelBanner.targetLevel;
      setLevelBanner(null);
      // The banner button is itself explicit confirmation — apply directly (#17).
      void applyChange("level", target);
    }
  };

  const handleLevelBannerDismiss = () => {
    setLevelBanner(null);
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const awaitingCorrection = lastAssistantMsg?.feedback?.awaitingCorrection;
  const preparing = initializing && messages.length === 0;

  // Typing dots stand in for the streaming assistant bubble only until its first
  // token arrives; after that the bubble itself shows the growing reply (#20).
  const streamingAssistant = messages.find((m) => m.id === PENDING_ASSISTANT_ID);
  const showTypingDots =
    loading && (!streamingAssistant || streamingAssistant.content.length === 0);

  return (
    <div className="flex flex-col h-full">
      <SessionHeader
        difficulty={difficulty}
        mode={mode}
        showFeedback={showFeedback}
        isMuted={tts.isMuted}
        onDifficultyChange={handleDifficultyChange}
        onModeChange={handleModeChange}
        onFeedbackToggle={() => setShowFeedback(!showFeedback)}
        onMuteToggle={tts.toggleMute}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {preparing && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pt-12">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg animate-pulse"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              S
            </div>
            <p className="text-text-muted text-sm">
              Sofia is getting ready…
            </p>
          </div>
        )}

        {messages.map((m) =>
          // The empty streaming bubble is represented by the typing dots below
          // until its first token arrives, so skip rendering an empty bubble.
          m.id === PENDING_ASSISTANT_ID && m.content.length === 0 ? null : (
            <MessageBubble
              key={m.id}
              message={m}
              showFeedback={showFeedback}
              immersion={mode === "immersion"}
            />
          ),
        )}

        {/* Typing indicator */}
        {showTypingDots && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              S
            </div>
            <div className="bg-bubble-assistant border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full bg-text-muted"
                style={{ animation: "typing-bounce 1.2s infinite ease-in-out 0s" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-text-muted"
                style={{ animation: "typing-bounce 1.2s infinite ease-in-out 0.2s" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-text-muted"
                style={{ animation: "typing-bounce 1.2s infinite ease-in-out 0.4s" }}
              />
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 mx-4 text-sm">
            {error}
          </div>
        )}

        {/* Session summary */}
        {sessionEnded && sessionId && (
          <SessionSummaryCard sessionId={sessionId} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirm-before-discard banner (#17) */}
      {pendingChange && (
        <div className="animate-slide-up bg-surface-2 border border-border rounded-lg mx-3 mb-2 p-3 flex items-center justify-between text-sm">
          <span className="text-text-muted">
            {pendingChange.type === "level"
              ? `Switch to ${pendingChange.value}? This starts a new conversation.`
              : `Switch to ${pendingChange.value === "immersion" ? "Immersion" : "Helper"} mode? This starts a new conversation.`}
          </span>
          <div className="flex gap-2 ml-3 shrink-0">
            <Button size="sm" onClick={confirmPendingChange}>
              Continue
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelPendingChange}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Difficulty level-up/down banner */}
      {levelBanner && !awaitingCorrection && (
        <div className="animate-slide-up bg-surface-2 border border-border rounded-lg mx-3 mb-2 p-3 flex items-center justify-between text-sm">
          <span className="text-text-muted">
            {levelBanner.direction === "up"
              ? `You're doing great — ready to try ${levelBanner.targetLevel}?`
              : `This seems challenging — want to try ${levelBanner.targetLevel}?`}
          </span>
          <div className="flex gap-2 ml-3 shrink-0">
            <Button size="sm" onClick={handleLevelBannerConfirm}>
              {levelBanner.direction === "up" ? "Level Up" : "Level Down"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLevelBannerDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Voice bar: the app is voice-only, so the mic is the only input. */}
      <div className="bg-surface/80 backdrop-blur-xl border-t border-border px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          {sessionId && !sessionEnded && (
            <Button variant="outline" size="sm" onClick={handleEndSession}>
              End
            </Button>
          )}
          {sessionEnded && (
            <Button variant="outline" size="sm" onClick={handleNewSession}>
              New Session
            </Button>
          )}
        </div>

        <VoiceButton
          state={voice.state}
          elapsed={voice.elapsed}
          heardSpeech={voice.heardSpeech}
          busy={loading}
          speaking={tts.isSpeaking}
          disabled={sessionEnded || initializing || !sessionId}
          onStart={handleTalk}
          onStop={voice.stop}
        />

        <div className="justify-self-end">
          <Button
            variant={handsFree ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleHandsFree}
            aria-pressed={handsFree}
            title={
              handsFree
                ? "Hands-free on: the mic opens after Sofia speaks"
                : "Hands-free off: tap the mic for each turn"
            }
          >
            {handsFree ? <Ear /> : <EarOff />}
            <span className="hidden min-[400px]:inline">Hands-free</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
