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

export function ConversationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState("A1");
  const [mode, setMode] = useState("helper");
  const [showFeedback, setShowFeedback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [levelBanner, setLevelBanner] = useState<{ direction: "up" | "down"; targetLevel: string } | null>(null);
  const consecutiveSignalRef = useRef<{ signal: string; count: number }>({ signal: "", count: 0 });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create session on first load or when settings change
  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const session = await api.createSession({
      language: "es",
      difficulty,
      mode,
    });
    setSessionId(session.id);
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

  const handleTranscript = useCallback(
    (transcript: string) => {
      setInput(transcript);
      handleSend(transcript);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, sessionId, difficulty, mode],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndSession = async () => {
    if (sessionId && messages.length > 0) {
      try {
        await api.endSession(sessionId);
      } catch {
        // Don't block UI if the API call fails
      }
      setSessionEnded(true);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    setSessionEnded(false);
    setLevelBanner(null);
    consecutiveSignalRef.current = { signal: "", count: 0 };
    clearTimeout(bannerTimerRef.current);
  };

  const handleDifficultyChange = (d: string) => {
    setDifficulty(d);
    handleNewSession();
  };

  const handleLevelBannerConfirm = () => {
    if (levelBanner) {
      handleDifficultyChange(levelBanner.targetLevel);
      setLevelBanner(null);
    }
  };

  const handleLevelBannerDismiss = () => {
    setLevelBanner(null);
  };

  const handleModeChange = (m: string) => {
    setMode(m);
    handleNewSession();
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const awaitingCorrection = lastAssistantMsg?.feedback?.awaitingCorrection;

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
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pt-12">
            {/* Sofia avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
            >
              S
            </div>
            {/* Gradient greeting */}
            <h2
              className="text-4xl font-bold"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ¡Hola!
            </h2>
            <p className="text-text-muted text-base max-w-xs">
              I'm <span className="text-text font-semibold">Sofia</span>, your Spanish tutor.
              Type a message in Spanish (or English) to begin!
            </p>
            <p className="text-text-dim text-sm">
              Level: {difficulty} · Mode: {mode}
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
        {sessionId && messages.length > 0 && !sessionEnded && (
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
          disabled={loading}
        />

        <VoiceButton onTranscript={handleTranscript} disabled={loading} />

        <Button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          size="icon"
          className="shrink-0"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
