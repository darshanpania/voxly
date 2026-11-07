import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatus, type VocabStatus } from "@/components/vocab-shared";
import { VocabReview } from "@/components/VocabReview";
import { ErrorState } from "@/components/ErrorState";
import { MessageAudioButton } from "@/components/MessageAudioButton";
import { PageHeader } from "@/components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { VocabularyItem } from "../lib/api";
import * as api from "../lib/api";

// Preferred order for category chips. Only categories present in the data are
// shown; unknown ones are added after these.
const KNOWN_CATEGORIES = [
  "greetings",
  "food",
  "travel",
  "numbers",
  "family",
  "work",
  "nature",
  "emotions",
  "shopping",
  "health",
  "general",
];

const DAY_MS = 24 * 60 * 60 * 1000;

type Filter = "all" | "due" | `cat:${string}`;

const TAGS: Partial<Record<VocabStatus, { label: string; className: string }>> = {
  due: { label: "SAY TODAY", className: "bg-text text-background" },
  new: { label: "NEW", className: "border border-es text-es" },
  mastered: { label: "KNOWN", className: "border border-border text-text-muted" },
};

function groupByDate(items: VocabularyItem[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const groups: Array<{ label: string; items: VocabularyItem[] }> = [
    { label: "TODAY", items: [] },
    { label: "THIS WEEK", items: [] },
    { label: "EARLIER", items: [] },
  ];
  for (const item of items) {
    const created = new Date(item.createdAt).getTime();
    if (created >= today) groups[0].items.push(item);
    else if (created >= today - 6 * DAY_MS) groups[1].items.push(item);
    else groups[2].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

function PhraseRow({ item }: { item: VocabularyItem }) {
  const tag = TAGS[getStatus(item)];
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span lang="es" className="font-display text-lg leading-snug font-semibold text-es">
          {item.word}
        </span>
        <span lang="en" className="text-sm leading-snug text-en">
          {item.definition}
        </span>
        {item.exampleSentence && (
          <span lang="es" className="text-[13px] leading-snug text-text-muted line-clamp-1">
            {item.exampleSentence}
          </span>
        )}
      </div>
      {tag && (
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.06em]",
            tag.className,
          )}
        >
          {tag.label}
        </span>
      )}
      <span className="shrink-0 -mr-2">
        <MessageAudioButton text={item.word} label={item.word} showSpeed={false} />
      </span>
    </li>
  );
}

export function PhrasebookPage() {
  const [dueVocab, setDueVocab] = useState<VocabularyItem[]>([]);
  const [allVocab, setAllVocab] = useState<VocabularyItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [practicing, setPracticing] = useState(false);

  const { data, loading, error, retry } = useApiData(
    () => Promise.all([api.getVocabulary("es"), api.getAllVocabulary("es")]),
    [],
  );

  // Seed the local lists the practice flow changes whenever a fetch resolves.
  useEffect(() => {
    if (data) {
      setDueVocab(data[0]);
      setAllVocab(data[1]);
    }
  }, [data]);

  // Saves a review and updates both lists. Rejects on failure so the practice
  // flow can show an inline error and let the learner try again.
  const handleReview = async (itemId: string, rating: number) => {
    const updated = await api.reviewVocab(itemId, rating);
    setDueVocab((prev) => prev.filter((v) => v.id !== itemId));
    setAllVocab((prev) => prev.map((v) => (v.id === itemId ? updated : v)));
  };

  const handleRestart = () => {
    api
      .getVocabulary("es")
      .then(setDueVocab)
      .catch(() => {});
  };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of allVocab) {
      if (v.category) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
    }
    const known = KNOWN_CATEGORIES.filter((c) => counts.has(c));
    const extra = [...counts.keys()].filter((c) => !KNOWN_CATEGORIES.includes(c));
    return [...known, ...extra].map((c) => ({ name: c, count: counts.get(c) ?? 0 }));
  }, [allVocab]);

  const groups = useMemo(() => {
    const dueIds = new Set(dueVocab.map((v) => v.id));
    const items =
      filter === "all"
        ? allVocab
        : filter === "due"
          ? allVocab.filter((v) => dueIds.has(v.id))
          : allVocab.filter((v) => v.category === filter.slice(4));
    const newestFirst = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return groupByDate(newestFirst);
  }, [allVocab, dueVocab, filter]);

  if (practicing) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Practice out loud"
          subtitle="Say each phrase in Spanish, then check."
          onBack={() => setPracticing(false)}
          backLabel="Back to Phrasebook"
        />
        <VocabReview
          queue={dueVocab}
          onReview={handleReview}
          onRestart={handleRestart}
          onBrowseAll={() => setPracticing(false)}
        />
      </div>
    );
  }

  const chips: Array<{ value: Filter; label: string }> = [
    { value: "all", label: `All · ${allVocab.length}` },
    { value: "due", label: `To practice · ${dueVocab.length}` },
    ...categories.map((c) => ({
      value: `cat:${c.name}` as Filter,
      label: `${c.name.charAt(0).toUpperCase()}${c.name.slice(1)} · ${c.count}`,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Phrasebook"
        subtitle={
          loading || error
            ? "Every word and phrase Sofía teaches you."
            : `${allVocab.length} ${allVocab.length === 1 ? "phrase" : "phrases"} · ${dueVocab.length} to say out loud today`
        }
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-sm">Loading your phrases…</p>
        </div>
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : allVocab.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <BookOpen className="w-10 h-10 text-text-dim" aria-hidden="true" />
          <p className="m-0 text-text-muted text-sm max-w-xs">
            Your Phrasebook is empty. Ask Sofía “How do I say…?” and the answer lands here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center h-11 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2"
          >
            Start talking
          </Link>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto px-5 pb-8">
            {dueVocab.length > 0 ? (
              <button
                type="button"
                onClick={() => setPracticing(true)}
                className="mt-2 w-full h-14 rounded-full bg-text text-background flex items-center justify-center gap-2.5 text-base font-semibold"
              >
                <Mic className="w-5 h-5" aria-hidden="true" />
                Practice {dueVocab.length} out loud
              </button>
            ) : (
              <p className="m-0 mt-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-muted text-center">
                Nothing to practice today. Nice work.
              </p>
            )}

            <div role="group" aria-label="Filter phrases" className="flex gap-2 overflow-x-auto pt-4 pb-1 -mx-1 px-1">
              {chips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={filter === chip.value}
                  onClick={() => setFilter(chip.value)}
                  className={cn(
                    "h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium border transition-colors",
                    filter === chip.value
                      ? "bg-text text-background border-text"
                      : "bg-transparent text-text border-border hover:border-border-bright",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <p className="m-0 mt-8 text-center text-sm text-text-muted">
                No phrases here yet.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.label} aria-label={group.label.toLowerCase()}>
                  <h2 className="m-0 mt-5 mb-1 text-[11px] font-semibold tracking-[0.12em] text-text-dim">
                    {group.label}
                  </h2>
                  <ul className="m-0 p-0 list-none">
                    {group.items.map((item) => (
                      <PhraseRow key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
