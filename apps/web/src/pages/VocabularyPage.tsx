import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { VocabularyItem } from "../lib/api";
import * as api from "../lib/api";

function getStatus(item: VocabularyItem): "due" | "mastered" | "learning" {
  if (item.timesCorrect >= 3) return "mastered";
  if (new Date(item.nextReviewAt) <= new Date()) return "due";
  return "learning";
}

export function VocabularyPage() {
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    api
      .getVocabulary("es")
      .then(setVocab)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (itemId: string, wasCorrect: boolean) => {
    setReviewing(itemId);
    try {
      const updated = await api.reviewVocab(itemId, wasCorrect);
      setVocab((prev) => prev.map((v) => (v.id === itemId ? updated : v)));
    } catch {
      // Review failure — non-critical
    } finally {
      setReviewing(null);
    }
  };

  if (loading) return <div className="loading">Loading vocabulary...</div>;

  return (
    <div className="vocabulary-page">
      <header className="vocabulary-page__header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h2>Vocabulary</h2>
      </header>

      {vocab.length === 0 ? (
        <div className="empty-state">
          <p>No vocabulary items due for review.</p>
          <Link to="/">Start a conversation to learn new words!</Link>
        </div>
      ) : (
        <div className="vocab-grid">
          {vocab.map((item) => {
            const status = getStatus(item);
            return (
              <div key={item.id} className={`vocab-card vocab-card--${status}`}>
                <div className="vocab-card__header">
                  <span className="vocab-card__word">{item.word}</span>
                  <span className={`vocab-card__status vocab-card__status--${status}`}>
                    {status}
                  </span>
                </div>
                <p className="vocab-card__definition">{item.definition}</p>
                {item.exampleSentence && (
                  <p className="vocab-card__example">{item.exampleSentence}</p>
                )}
                <div className="vocab-card__meta">
                  Seen {item.timesSeen}x · Correct {item.timesCorrect}x
                </div>
                <div className="vocab-card__actions">
                  <button
                    className="vocab-card__btn vocab-card__btn--incorrect"
                    onClick={() => handleReview(item.id, false)}
                    disabled={reviewing === item.id}
                  >
                    Incorrect
                  </button>
                  <button
                    className="vocab-card__btn vocab-card__btn--correct"
                    onClick={() => handleReview(item.id, true)}
                    disabled={reviewing === item.id}
                  >
                    Correct
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
