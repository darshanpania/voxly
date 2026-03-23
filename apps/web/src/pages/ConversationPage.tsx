import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { SessionHeader } from "../components/SessionHeader";
import { MessageBubble } from "../components/MessageBubble";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
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
        onDifficultyChange={handleDifficultyChange}
        onModeChange={handleModeChange}
        onFeedbackToggle={() => setShowFeedback(!showFeedback)}
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
        <div ref={messagesEndRef} />
      </div>

      <div className="input-bar">
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
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
