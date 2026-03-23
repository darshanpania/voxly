import { useState } from "react";
import type { MessageFeedback } from "../lib/api";

interface Props {
  feedback: MessageFeedback;
}

export function FeedbackCard({ feedback }: Props) {
  const [expanded, setExpanded] = useState(true);
  const corrections = feedback.corrections || [];
  const vocabNotes = feedback.vocabNotes || [];

  if (corrections.length === 0 && vocabNotes.length === 0) return null;

  return (
    <div className="feedback-card">
      <button
        className="feedback-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "▾" : "▸"} Feedback
      </button>
      {expanded && (
        <div className="feedback-body">
          {corrections.length > 0 && (
            <div className="feedback-section">
              <h4>Corrections</h4>
              {corrections.map((c, i) => (
                <div key={i} className="correction">
                  <span className="correction-original">{c.original}</span>
                  <span className="correction-arrow"> → </span>
                  <span className="correction-fixed">{c.corrected}</span>
                  <p className="correction-explanation">{c.explanation}</p>
                </div>
              ))}
            </div>
          )}
          {vocabNotes.length > 0 && (
            <div className="feedback-section">
              <h4>Vocab Notes</h4>
              {vocabNotes.map((v, i) => (
                <div key={i} className="vocab-note">
                  <strong>{v.word}</strong> — {v.definition}
                  <p className="vocab-example">"{v.example}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
