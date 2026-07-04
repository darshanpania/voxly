import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { SessionHeader } from "../components/SessionHeader";
import { MessageBubble } from "../components/MessageBubble";
import { VoiceButton } from "../components/VoiceButton";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { useTTS } from "../hooks/useTTS";
import type { Message } from "../lib/api";
import * as api from "../lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LANGUAGE = "es";
const ACTIVE_SESSION_KEY = "voxly:activeSession";

export function ConversationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tts = useTTS();

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
      if (greeting) tts.play(greeting.content);
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

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    if (!overrideText) setInput("");
    setError(null);
    setLoading(true);

    try {
      const sid = await ensureSession();
      const res = await api.sendMessage(sid, text);

      setMessages((prev) => [
        ...prev,
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

      // Auto-play assistant reply
      tts.play(res.assistantMessage.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Whisper regularly mishears beginners, so don't auto-send. Drop the
  // transcript into the input and focus it so the learner can review/edit
  // before tapping Send (#12).
  const handleTranscript = useCallback((transcript: string) => {
    setInput(transcript);
    setError(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndSession = async () => {
    if (sessionId) {
      api.endSession(sessionId).catch(() => {});
      setSessionEnded(true);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  };

  const handleNewSession = async () => {
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

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} showFeedback={showFeedback} />
        ))}

        {/* Typing indicator */}
        {loading && (
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

      {/* Input bar */}
      <div className="bg-surface/80 backdrop-blur-xl border-t border-border p-3 flex items-end gap-2">
        {sessionId && !sessionEnded && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEndSession}
            className="shrink-0"
          >
            End
          </Button>
        )}
        {sessionEnded && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSession}
            className="shrink-0"
          >
            New Session
          </Button>
        )}

        <textarea
          ref={textareaRef}
          className={cn(
            "flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2.5",
            "text-text placeholder:text-text-dim resize-none",
            "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
            "transition-colors text-sm leading-relaxed",
          )}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={awaitingCorrection ? "Try the correction..." : "Type your message..."}
          rows={1}
          disabled={loading || sessionEnded}
        />

        <VoiceButton
          onTranscript={handleTranscript}
          onError={setError}
          disabled={loading || sessionEnded}
        />

        <Button
          onClick={() => handleSend()}
          disabled={loading || sessionEnded || !input.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
