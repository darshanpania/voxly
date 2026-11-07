import { useState } from "react";
import { AlertCircle, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageAudioButton } from "./MessageAudioButton";
import type { VocabularyItem } from "../lib/api";

interface RatingConfig {
  rating: number;
  label: string;
  hint: string;
  className: string;
}

// FSRS ratings, in plain words for a spoken answer.
const RATINGS: RatingConfig[] = [
  { rating: 1, label: "Again", hint: "I forgot", className: "text-danger" },
  { rating: 2, label: "Hard", hint: "Slow", className: "text-warning" },
  { rating: 3, label: "Good", hint: "Got it", className: "text-success" },
  { rating: 4, label: "Easy", hint: "Instant", className: "text-en" },
];

interface VocabReviewProps {
  /** The remaining due queue. The current card is always the first item. */
  queue: VocabularyItem[];
  /** Reviews an item; resolves on success (parent removes it from the queue), rejects on failure. */
  onReview: (itemId: string, rating: number) => Promise<void>;
  /** Re-fetches the due queue so the learner can run another pass. */
  onRestart: () => void;
  /** Goes back to the full Phrasebook list. */
  onBrowseAll: () => void;
}

/**
 * Speaking practice for due phrases. The card shows the English meaning, you
 * say the Spanish out loud, then you check it, hear it, and rate yourself.
 */
export function VocabReview({ queue, onReview, onRestart, onBrowseAll }: VocabReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cards reviewed in this pass — drives the progress counter.
  const [reviewedCount, setReviewedCount] = useState(0);

  const current = queue[0];
  const total = queue.length + reviewedCount;

  if (!current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Sparkles className="w-10 h-10 text-es" aria-hidden="true" />
        <h2 className="m-0 font-display text-2xl font-bold">
          {reviewedCount > 0 ? "All done" : "Nothing due"}
        </h2>
        <p className="m-0 text-text-muted text-sm max-w-xs">
          {reviewedCount > 0
            ? `You said ${reviewedCount} ${reviewedCount === 1 ? "phrase" : "phrases"} out loud. Come back when more are due.`
            : "No phrases are due right now. Keep talking with Sofía to learn new ones."}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setReviewedCount(0);
              setRevealed(false);
              setError(null);
              onRestart();
            }}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Check again
          </button>
          <button
            type="button"
            onClick={onBrowseAll}
            className="inline-flex items-center h-11 px-4 rounded-full text-sm font-medium text-text-muted hover:text-text hover:bg-surface-2"
          >
            Back to Phrasebook
          </button>
        </div>
      </div>
    );
  }

  const handleRate = async (rating: number) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onReview(current.id, rating);
      // Parent removed the item from `queue`; advance to the next card.
      setReviewedCount((n) => n + 1);
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-5 pb-8 flex flex-col gap-4">
        {/* Progress */}
        <div className="flex items-center gap-3 pt-1">
          <div
            className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={reviewedCount}
            aria-label="Practice progress"
          >
            <div
              className="h-full rounded-full bg-text transition-all duration-300"
              style={{ width: `${(reviewedCount / total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-text-muted tabular-nums shrink-0">
            {reviewedCount + 1} / {total}
          </span>
        </div>

        {/* Prompt: the meaning in English */}
        <div className="rounded-3xl border border-border bg-surface px-6 py-7 flex flex-col items-center text-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-text-dim">
            SAY IT IN SPANISH
          </span>
          <p lang="en" className="m-0 font-display text-[27px] leading-tight font-semibold text-en text-balance">
            {current.definition}
          </p>
          {current.category && (
            <span className="text-xs text-text-muted capitalize">{current.category}</span>
          )}
        </div>

        {!revealed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="w-full h-14 rounded-full bg-text text-background text-base font-semibold"
            >
              Check the Spanish
            </button>
            <span className="text-xs text-text-muted">Say it out loud first.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Answer: the Spanish, to hear and compare */}
            <div className="rounded-3xl border border-es/40 bg-surface px-6 py-5 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1">
                <span lang="es" className="font-display text-[32px] leading-tight font-bold text-es">
                  {current.word}
                </span>
                <MessageAudioButton text={current.word} label={current.word} showSpeed={false} />
              </div>
              {current.exampleSentence && (
                <p lang="es" className="m-0 text-sm leading-snug text-text-muted">
                  {current.exampleSentence}
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-2xl border border-danger/40 px-3 py-2 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <p className="m-0 mb-2 text-center text-xs text-text-muted">How did you do?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.rating}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRate(r.rating)}
                    className={cn(
                      "h-16 rounded-2xl border border-border bg-surface flex flex-col items-center justify-center gap-0.5 hover:border-border-bright disabled:opacity-50",
                      r.className,
                    )}
                  >
                    <span className="text-sm font-semibold">{r.label}</span>
                    <span className="text-[11px] text-text-muted">{r.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
