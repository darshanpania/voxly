import { Link, useParams } from "react-router-dom";
import { ChevronRight, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { TranscriptMessage } from "../components/TranscriptMessage";
import { PageHeader } from "../components/PageHeader";
import { ErrorState } from "../components/ErrorState";
import { useApiData } from "../hooks/useApiData";
import type { Session } from "../lib/api";
import * as api from "../lib/api";

function formatDuration(session: Session): string {
  // Prefer the backend-provided durationMinutes when available.
  if (typeof session.durationMinutes === "number") {
    return `${session.durationMinutes} min`;
  }
  // Fall back to computing from endedAt only when the session has ended.
  if (session.endedAt) {
    const mins = Math.round(
      (new Date(session.endedAt).getTime() -
        new Date(session.createdAt).getTime()) /
        60000,
    );
    return `${mins} min`;
  }
  // Un-ended session: no meaningful duration to show.
  return "—";
}

function SessionList() {
  const { data, loading, error, retry } = useApiData(() => api.getSessions(), []);
  const sessions = data ?? [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} retry={retry} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Clock className="w-10 h-10 text-text-dim" aria-hidden="true" />
        <p className="m-0 text-text-muted text-sm">No sessions yet</p>
        <Link
          to="/"
          className="inline-flex items-center h-11 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2"
        >
          Start talking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="m-0 list-none w-full max-w-2xl mx-auto px-5 pb-8 pt-1 flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              to={`/history/${s.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 min-h-16 hover:border-border-bright transition-colors"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-text">
                  {new Date(s.createdAt).toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-[13px] text-text-muted">
                  {s.difficulty} · {s.mode === "immersion" ? "Immersion" : "Helper"} ·{" "}
                  {formatDuration(s)} · {s._count?.messages ?? 0} turns
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-text-dim shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    data: session,
    loading,
    error,
    retry,
  } = useApiData(() => api.getSession(id as string), [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} retry={retry} />;
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="m-0 text-danger text-sm">Session not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-5 pb-8 pt-1 flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
          <Badge variant="secondary">{session.difficulty}</Badge>
          <Badge variant="secondary">
            {session.mode === "immersion" ? "Immersion" : "Helper"}
          </Badge>
          <span>{formatDuration(session)}</span>
        </div>

        <SessionSummaryCard sessionId={session.id} />

        <p className="m-0 text-[13px] text-text-muted">
          <span className="text-es font-semibold">Amber</span> is Spanish.{" "}
          <span className="text-en font-semibold">Blue</span> is English.
        </p>
        <div className="flex flex-col gap-5">
          {session.messages?.map((m) => (
            <TranscriptMessage
              key={m.id}
              message={m}
              showFeedback={true}
              showTranslation={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SessionHistoryPage() {
  const { id } = useParams();

  return (
    <div className="flex flex-col h-full">
      {id ? (
        <PageHeader title="Session" backTo="/history" backLabel="Back to history" />
      ) : (
        <PageHeader title="History" subtitle="Every talk with Sofía, newest first." />
      )}
      {id ? <SessionDetail /> : <SessionList />}
    </div>
  );
}
