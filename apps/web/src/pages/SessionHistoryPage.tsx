import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { MessageBubble } from "../components/MessageBubble";
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
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} retry={retry} />;
  }

  if (sessions.length === 0) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
      {sessions.map((s) => (
        <Link key={s.id} to={`/history/${s.id}`} className="block">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer p-3">
            <div className="flex items-center justify-between gap-3">
              {/* Left: language + difficulty + mode */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-sm text-text truncate">
                  {s.language.toUpperCase()} · {s.difficulty}
                </span>
                <Badge variant="secondary">{s.mode}</Badge>
              </div>

              {/* Right: date, duration, message count */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-text-muted">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <span className="text-sm text-text-dim">
                  {formatDuration(s)}
                </span>
                <span className="text-sm text-text-dim">
                  {s._count?.messages ?? 0} msgs
                </span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
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
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} retry={retry} />;
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-danger text-sm">Session not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Session detail header bar */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">
            {session.language.toUpperCase()}
          </span>
          <span className="text-text-dim text-sm">·</span>
          <Badge variant="secondary">{session.difficulty}</Badge>
          <Badge variant="default">{session.mode}</Badge>
        </div>
        <span className="text-sm text-text-muted shrink-0">
          {new Date(session.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Stacked: session summary, then full transcript */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <SessionSummaryCard sessionId={session.id} />

        <div className="flex flex-col gap-2">
          {session.messages?.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              showFeedback={true}
              immersion={session.mode === "immersion"}
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
      {/* Header */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-3 shrink-0">
        <Link
          to={id ? "/history" : "/"}
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

      {id ? <SessionDetail /> : <SessionList />}
    </div>
  );
}
