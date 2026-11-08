import { ArrowRight, Bookmark } from "lucide-react";
import type { MessageFeedback } from "../lib/api";
import { EnglishNote } from "./halo/LangText";

interface Props {
  feedback: MessageFeedback;
}

/**
 * Fixes and new words under one of Sofía's turns. Spanish stays amber and the
 * English explanation stays blue, like everywhere else in the app.
 */
export function FeedbackCard({ feedback }: Props) {
  const corrections = feedback.corrections || [];
  const vocabNotes = feedback.vocabNotes || [];

  if (corrections.length === 0 && vocabNotes.length === 0) return null;

  return (
    <div className="mt-2 rounded-2xl border border-border bg-surface px-3.5 py-3 flex flex-col gap-3">
      {corrections.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-text-dim">
            {corrections.length === 1 ? "FIX" : "FIXES"}
          </span>
          {corrections.map((c, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px]">
                <s lang="es" className="text-danger decoration-2">
                  {c.original}
                </s>
                <ArrowRight className="w-3.5 h-3.5 text-text-dim shrink-0" aria-label="becomes" />
                <span lang="es" className="text-es font-semibold">
                  {c.corrected}
                </span>
              </span>
              {c.explanation && (
                <EnglishNote text={c.explanation} className="text-sm leading-snug" />
              )}
            </div>
          ))}
        </div>
      )}

      {vocabNotes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-text-dim">
            <Bookmark className="w-3 h-3" aria-hidden="true" />
            SAVED TO PHRASEBOOK
          </span>
          {vocabNotes.map((v, i) => (
            <div key={i} className="text-sm leading-snug">
              <span lang="es" className="text-es font-semibold">
                {v.word}
              </span>
              <span className="text-text-dim"> · </span>
              <span lang="en" className="text-en">
                {v.definition}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
