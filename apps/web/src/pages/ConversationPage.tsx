import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { SessionHeader } from "../components/SessionHeader";
import { MessageBubble } from "../components/MessageBubble";
import { VoiceButton } from "../components/VoiceButton";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { useTTS } from "../hooks/useTTS";
import type { Message } from "../lib/api";
import * as api from "../lib/api";

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
        { ...res.assistantMessage, feedback: res.feedback },
      ]);

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

  const handleEndSession = () => {
    if (sessionId && messages.length > 0) {
      setSessionEnded(true);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    setSessionEnded(false);
  };

  const handleDifficultyChange = (d: string) => {
    setDifficulty(d);
    handleNewSession();
  };

  const handleModeChange = (m: string) => {
    setMode(m);
    handleNewSession();
  };

  return (
    <div className="conversation-page">
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

      <div className="messages-container">
        {messages.length === 0 && !loading && (
          <div className="empty-state">
            <p>
              ¡Hola! I'm <strong>Sofia</strong>, your Spanish tutor.
            </p>
            <p>Type a message in Spanish (or English) to begin!</p>
            <p className="empty-state__hint">
              Level: {difficulty} · Mode: {mode}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} showFeedback={showFeedback} />
        ))}
        {loading && (
          <div className="message-row message-row--assistant">
            <div className="avatar">S</div>
            <div className="bubble bubble--assistant typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        {sessionEnded && sessionId && (
          <SessionSummaryCard sessionId={sessionId} />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-bar">
        {sessionId && messages.length > 0 && !sessionEnded && (
          <button
            className="end-session-btn"
            onClick={handleEndSession}
            title="End Session"
          >
            End
          </button>
        )}
        {sessionEnded && (
          <button className="new-session-btn" onClick={handleNewSession}>
            New Session
          </button>
        )}
        <Link to="/sessions" className="sessions-link" title="Past Sessions">
          ☰
        </Link>
        <textarea
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={1}
          disabled={loading}
        />
        <VoiceButton
          onTranscript={handleTranscript}
          disabled={loading}
        />
        <button
          className="send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
