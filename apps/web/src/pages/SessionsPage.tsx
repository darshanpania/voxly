import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageBubble } from "../components/MessageBubble";
import type { Session } from "../lib/api";
import * as api from "../lib/api";

function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading sessions...</div>;
  if (sessions.length === 0)
    return (
      <div className="empty-state">
        <p>No sessions yet.</p>
        <Link to="/">Start a conversation</Link>
      </div>
    );

  return (
    <div className="sessions-list">
      {sessions.map((s) => (
        <Link key={s.id} to={`/sessions/${s.id}`} className="session-card">
          <div className="session-card__info">
            <strong>
              {s.language.toUpperCase()} · {s.difficulty}
            </strong>
            <span className="session-card__mode">{s.mode}</span>
          </div>
          <div className="session-card__meta">
            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
            <span>{s._count?.messages ?? 0} messages</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getSession(id)
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!session) return <div className="error-banner">Session not found</div>;

  return (
    <div className="session-detail">
      <div className="session-detail__header">
        <strong>
          {session.language.toUpperCase()} · {session.difficulty} ·{" "}
          {session.mode}
        </strong>
        <span>{new Date(session.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="messages-container">
        {session.messages?.map((m) => (
          <MessageBubble key={m.id} message={m} showFeedback={true} />
        ))}
      </div>
    </div>
  );
}

export function SessionsPage() {
  const { id } = useParams();

  return (
    <div className="sessions-page">
      <header className="sessions-page__header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h2>Past Sessions</h2>
      </header>
      {id ? <SessionDetail /> : <SessionList />}
    </div>
  );
}
