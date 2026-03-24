import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import type { Session } from "../lib/api";
import * as api from "../lib/api";

function formatDuration(createdAt: string, endedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const mins = Math.round((end - start) / 60000);
  return `${mins} min`;
}

export function SessionHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading sessions...</div>;

  return (
    <div className="history-page">
      <header className="history-page__header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h2>Session History</h2>
      </header>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>No sessions yet.</p>
          <Link to="/">Start your first conversation!</Link>
        </div>
      ) : (
        <div className="history-list">
          {sessions.map((s) => (
            <div key={s.id} className="history-item">
              <div
                className="history-item__header"
                onClick={() =>
                  setExpandedId(expandedId === s.id ? null : s.id)
                }
              >
                <div className="history-item__info">
                  <strong>
                    {s.language.toUpperCase()} · {s.difficulty}
                  </strong>
                  <span className="history-item__mode">{s.mode}</span>
                </div>
                <div className="history-item__meta">
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span>{formatDuration(s.createdAt, s.endedAt)}</span>
                  <span>{s._count?.messages ?? 0} msgs</span>
                </div>
              </div>
              {expandedId === s.id && (
                <div className="history-item__summary">
                  <SessionSummaryCard sessionId={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
