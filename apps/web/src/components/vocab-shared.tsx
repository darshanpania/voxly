import { CheckCircle2, Clock3, GraduationCap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { VocabularyItem } from "../lib/api";
import { Badge, type BadgeProps } from "@/components/ui/badge";

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

const STATUS_ICON: Record<VocabStatus, LucideIcon> = {
  mastered: CheckCircle2,
  due: Clock3,
  learning: GraduationCap,
  new: Sparkles,
};

/**
 * Status badge that pairs the status text with an icon so the meaning is not
 * communicated by color alone.
 */
export function StatusBadge({ status }: { status: VocabStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant={statusBadgeVariant(status)} className="gap-1">
      <Icon size={12} className="shrink-0" />
      {status}
    </Badge>
  );
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
