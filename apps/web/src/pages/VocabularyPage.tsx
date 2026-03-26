import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { VocabularyItem } from "../lib/api";
import * as api from "../lib/api";

function getStatus(item: VocabularyItem): "mastered" | "due" | "learning" | "new" {
  if (item.state === 2 && item.stability > 21) return "mastered";
  if (new Date(item.nextReviewAt) <= new Date()) return "due";
  if (item.state === 1 || item.state === 3) return "learning";
  return "new";
}

function StabilityBar({ stability }: { stability: number }) {
  const pct = Math.min(100, Math.round((stability / 30) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-dim">{stability.toFixed(1)}d</span>
    </div>
  );
}

export function VocabularyPage() {
  const [dueVocab, setDueVocab] = useState<VocabularyItem[]>([]);
  const [allVocab, setAllVocab] = useState<VocabularyItem[]>([]);
  const [tab, setTab] = useState<"due" | "all">("due");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getVocabulary("es"),
      api.getAllVocabulary("es"),
    ])
      .then(([due, all]) => {
        setDueVocab(due);
        setAllVocab(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (itemId: string, rating: number) => {
    setReviewing(itemId);
    try {
      const updated = await api.reviewVocab(itemId, rating);
      const update = (prev: VocabularyItem[]) =>
        prev.map((v) => (v.id === itemId ? updated : v));
      setDueVocab(update);
      setAllVocab(update);
    } catch {
      // Review failure — non-critical
    } finally {
      setReviewing(null);
    }
  };

  const vocab = tab === "due" ? dueVocab : allVocab;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-3 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold gradient-text">Vocabulary</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-0 flex gap-2 shrink-0">
        <button
          onClick={() => setTab("due")}
          className={cn(
            "px-4 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
            tab === "due"
              ? "bg-primary text-white"
              : "bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3"
          )}
        >
          Due for Review
          {dueVocab.length > 0 && (
            <span className="ml-2 text-xs opacity-80">({dueVocab.length})</span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={cn(
            "px-4 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors",
            tab === "all"
              ? "bg-primary text-white"
              : "bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3"
          )}
        >
          All Words
          {allVocab.length > 0 && (
            <span className="ml-2 text-xs opacity-80">({allVocab.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-sm">Loading vocabulary...</p>
        </div>
      ) : vocab.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <BookOpen className="w-12 h-12 text-text-dim opacity-40" />
          <p className="text-text-muted text-sm">No vocabulary items</p>
          <Link
            to="/"
            className="text-primary text-sm hover:text-primary-hover transition-colors"
          >
            Start a conversation to learn new words
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 overflow-y-auto flex-1">
          {vocab.map((item) => {
            const status = getStatus(item);
            const isReviewing = reviewing === item.id;
            return (
              <Card key={item.id} className="flex flex-col gap-3 p-4">
                {/* Word + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold text-text leading-tight">
                    {item.word}
                  </span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant={
                        status === "mastered"
                          ? "success"
                          : status === "due"
                          ? "warning"
                          : status === "learning"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {status}
                    </Badge>
                    {item.category && (
                      <Badge variant="outline">{item.category}</Badge>
                    )}
                  </div>
                </div>

                {/* Definition */}
                <p className="text-sm text-text-muted leading-relaxed">
                  {item.definition}
                </p>

                {/* Example */}
                {item.exampleSentence && (
                  <p className="text-xs text-text-dim italic border-l-2 border-border pl-2">
                    {item.exampleSentence}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-dim">
                    Seen {item.timesSeen}x · Correct {item.timesCorrect}x
                  </span>
                  <StabilityBar stability={item.stability ?? 0} />
                </div>

                {/* FSRS Rating buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReviewing}
                    onClick={() => handleReview(item.id, 1)}
                    className="text-danger border-danger/30 hover:bg-danger/10 hover:border-danger/50 text-xs"
                  >
                    Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReviewing}
                    onClick={() => handleReview(item.id, 2)}
                    className="text-warning border-warning/30 hover:bg-warning/10 hover:border-warning/50 text-xs"
                  >
                    Hard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReviewing}
                    onClick={() => handleReview(item.id, 3)}
                    className="text-success border-success/30 hover:bg-success/10 hover:border-success/50 text-xs"
                  >
                    Good
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReviewing}
                    onClick={() => handleReview(item.id, 4)}
                    className="text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50 text-xs"
                  >
                    Easy
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
