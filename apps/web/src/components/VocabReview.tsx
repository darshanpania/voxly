import { useState } from "react";
import { Eye, Sparkles, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { VocabularyItem } from "../lib/api";

interface RatingConfig {
  rating: number;
  label: string;
  className: string;
}

const RATINGS: RatingConfig[] = [
  {
    rating: 1,
    label: "Again",
    className:
      "text-danger border-danger/30 hover:bg-danger/10 hover:border-danger/50",
  },
  {
    rating: 2,
    label: "Hard",
    className:
      "text-warning border-warning/30 hover:bg-warning/10 hover:border-warning/50",
  },
  {
    rating: 3,
    label: "Good",
    className:
      "text-success border-success/30 hover:bg-success/10 hover:border-success/50",
  },
  {
    rating: 4,
    label: "Easy",
    className:
      "text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50",
  },
];

interface VocabReviewProps {
  /** The remaining due queue. The current card is always the first item. */
  queue: VocabularyItem[];
  /** Reviews an item; resolves on success (parent removes it from the queue), rejects on failure. */
  onReview: (itemId: string, rating: number) => Promise<void>;
  /** Re-fetches the due queue so the user can run another pass. */
  onRestart: () => void;
  /** Switches to the "All Words" tab. */
  onBrowseAll: () => void;
}

export function VocabReview({
  queue,
  onReview,
  onRestart,
  onBrowseAll,
}: VocabReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cards reviewed in this pass — drives the progress counter.
  const [reviewedCount, setReviewedCount] = useState(0);

  const current = queue[0];
  const total = queue.length + reviewedCount;

  // Completion state: nothing left to review.
  if (!current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Sparkles className="w-12 h-12 text-primary" />
        <h3 className="text-2xl font-bold gradient-text">
          {reviewedCount > 0 ? "Review complete!" : "All caught up"}
        </h3>
        <p className="text-text-muted text-sm max-w-xs">
          {reviewedCount > 0
            ? `You reviewed ${reviewedCount} ${reviewedCount === 1 ? "word" : "words"}. Nice work — come back when more are due.`
            : "No words are due for review right now. Keep chatting to learn new ones."}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReviewedCount(0);
              setRevealed(false);
              setError(null);
              onRestart();
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Review again
          </Button>
          <Button variant="ghost" size="sm" onClick={onBrowseAll}>
            Browse all words
          </Button>
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
      setError(
        err instanceof Error ? err.message : "Couldn't save review. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-4 p-4 overflow-y-auto">
      {/* Progress indicator */}
      <div className="w-full max-w-md flex items-center gap-3 shrink-0">
        <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(reviewedCount / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-dim tabular-nums shrink-0">
          {reviewedCount + 1} / {total}
        </span>
      </div>

      {/* Card */}
      <Card
        role={!revealed ? "button" : undefined}
        tabIndex={!revealed ? 0 : undefined}
        onClick={!revealed ? () => setRevealed(true) : undefined}
        onKeyDown={
          !revealed
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setRevealed(true);
                }
              }
            : undefined
        }
        className={cn(
          "w-full max-w-md flex flex-col gap-5 p-6 min-h-[16rem]",
          !revealed && "cursor-pointer select-none",
        )}
      >
        {/* Category badge */}
        {current.category && (
          <div className="flex justify-center">
            <Badge variant="outline">{current.category}</Badge>
          </div>
        )}

        {/* Front: the Spanish word */}
        <div className="flex-1 flex items-center justify-center text-center">
          <span className="text-3xl font-bold text-text leading-tight">
            {current.word}
          </span>
        </div>

        {!revealed ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setRevealed(true);
              }}
            >
              <Eye className="w-4 h-4" />
              Show answer
            </Button>
            <span className="text-xs text-text-dim">Tap the card to reveal</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Back: definition + example */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-base text-text leading-relaxed text-center">
                {current.definition}
              </p>
              {current.exampleSentence && (
                <p className="text-sm text-text-muted italic border-l-2 border-border pl-3">
                  {current.exampleSentence}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* FSRS rating buttons */}
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <Button
                  key={r.rating}
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleRate(r.rating)}
                  className={cn("h-12", r.className)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <p className="text-center text-xs text-text-dim">
              How well did you recall it?
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
