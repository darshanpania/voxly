import type { VocabularyItem } from "../lib/api";
import type { BadgeProps } from "@/components/ui/badge";

export type VocabStatus = "mastered" | "due" | "learning" | "new";

export function getStatus(item: VocabularyItem): VocabStatus {
  if (item.state === 2 && item.stability > 21) return "mastered";
  if (new Date(item.nextReviewAt) <= new Date()) return "due";
  if (item.state === 1 || item.state === 3) return "learning";
  return "new";
}

export function statusBadgeVariant(status: VocabStatus): BadgeProps["variant"] {
  return status === "mastered"
    ? "success"
    : status === "due"
      ? "warning"
      : status === "learning"
        ? "default"
        : "secondary";
}

export function StabilityBar({ stability }: { stability: number }) {
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
