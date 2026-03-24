import { useEffect, useState } from "react";
import type { SessionSummary } from "../lib/api";
import * as api from "../lib/api";

interface Props {
  sessionId: string;
}

export function SessionSummaryCard({ sessionId }: Props) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSessionSummary(sessionId)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="summary-card summary-card--loading">
        <p>Generating session summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-card summary-card--error">
        <p>Failed to load summary: {error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="summary-card">
      <h3>Session Summary</h3>

      {summary.topics.length > 0 && (
        <div className="summary-card__section">
          <h4>Topics Covered</h4>
          <ul>
            {summary.topics.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.mistakes.length > 0 && (
        <div className="summary-card__section">
          <h4>Areas to Improve</h4>
          <ul>
            {summary.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.newVocab.length > 0 && (
        <div className="summary-card__section">
          <h4>New Vocabulary</h4>
          <div className="summary-card__badges">
            {summary.newVocab.map((v, i) => (
              <span key={i} className="summary-card__badge">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="summary-card__encouragement">
        <p>{summary.encouragement}</p>
      </div>
    </div>
  );
}
