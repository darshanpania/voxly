import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Sparkles,
  ChevronDown,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
    <Collapsible.Root
      open={expanded}
      onOpenChange={setExpanded}
      className="mt-2 rounded-xl border border-border bg-surface-2/50 overflow-hidden"
    >
      <Collapsible.Trigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-muted hover:text-text transition-colors cursor-pointer">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Feedback
          </span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <div className="px-3 pb-3 space-y-3">
          {/* Corrections */}
          {corrections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-warning" />
                <span className="text-warning text-xs font-medium uppercase tracking-wide">
                  Corrections
                </span>
              </div>
              {corrections.map((c, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-danger/80 line-through text-sm">
                    {c.original}
                  </span>
                  <span className="flex items-center gap-1 text-success text-sm font-medium">
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    {c.corrected}
                  </span>
                  {c.explanation && (
                    <span className="text-text-dim text-xs italic">
                      {c.explanation}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Vocab Notes */}
          {vocabNotes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-primary" />
                <span className="text-primary text-xs font-medium uppercase tracking-wide">
                  Vocabulary
                </span>
              </div>
              {vocabNotes.map((v, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{v.word}</Badge>
                    <span className="text-sm text-text-muted">{v.definition}</span>
                  </div>
                  {v.example && (
                    <span className="text-xs text-text-dim italic pl-1">
                      &ldquo;{v.example}&rdquo;
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
