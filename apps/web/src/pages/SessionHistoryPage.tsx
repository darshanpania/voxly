import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import type { Session } from "../lib/api";
import * as api from "../lib/api";

function formatDuration(createdAt: string, endedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const mins = Math.round((end - start) / 60000);
  return `${mins} min`;
}

export function SessionHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold gradient-text">Session History</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <Clock className="w-12 h-12 text-text-dim opacity-40" />
          <p className="text-text-muted text-sm">No sessions yet</p>
          <Link
            to="/"
            className="text-primary text-sm hover:text-primary-hover transition-colors"
          >
            Start your first conversation
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
          {sessions.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <Card key={s.id} className="overflow-hidden p-0">
                {/* Header row */}
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  {/* Left: language + difficulty + mode */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-text truncate">
                      {s.language.toUpperCase()} · {s.difficulty}
                    </span>
                    <Badge variant="secondary">{s.mode}</Badge>
                  </div>

                  {/* Right: date, duration, count, chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-text-muted">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-sm text-text-dim">
                      {formatDuration(s.createdAt, s.endedAt)}
                    </span>
                    <span className="text-sm text-text-dim">
                      {s._count?.messages ?? 0} msgs
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-text-dim transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {/* Expanded: session summary */}
                {isExpanded && (
                  <div className="border-t border-border pt-3 px-4 pb-4">
                    <SessionSummaryCard sessionId={s.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
