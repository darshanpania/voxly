import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getStatus,
  statusBadgeVariant,
  StabilityBar,
} from "@/components/vocab-shared";
import { VocabReview } from "@/components/VocabReview";
import type { VocabularyItem } from "../lib/api";
import * as api from "../lib/api";

export function VocabularyPage() {
  const [dueVocab, setDueVocab] = useState<VocabularyItem[]>([]);
  const [allVocab, setAllVocab] = useState<VocabularyItem[]>([]);
  const [tab, setTab] = useState<"due" | "all">("due");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getVocabulary("es"), api.getAllVocabulary("es")])
      .then(([due, all]) => {
        setDueVocab(due);
        setAllVocab(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reviews an item and reconciles both datasets. Rejects on failure so the
  // review flow can surface an inline error and let the user retry.
  const handleReview = async (itemId: string, rating: number) => {
    const updated = await api.reviewVocab(itemId, rating);
    // Remove from the due queue immediately (client-side removal is fine).
    setDueVocab((prev) => prev.filter((v) => v.id !== itemId));
    // Keep the "All Words" copy fresh so stability/state badges reflect the review.
    setAllVocab((prev) => prev.map((v) => (v.id === itemId ? updated : v)));
  };

  const handleRestart = () => {
    api
      .getVocabulary("es")
      .then(setDueVocab)
      .catch(() => {});
  };

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
              : "bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3",
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
              : "bg-surface-2 text-text-muted hover:text-text hover:bg-surface-3",
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
      ) : tab === "due" ? (
        <VocabReview
          queue={dueVocab}
          onReview={handleReview}
          onRestart={handleRestart}
          onBrowseAll={() => setTab("all")}
        />
      ) : allVocab.length === 0 ? (
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
          {allVocab.map((item) => {
            const status = getStatus(item);
            return (
              <Card key={item.id} className="flex flex-col gap-3 p-4">
                {/* Word + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold text-text leading-tight">
                    {item.word}
                  </span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
