import { useEffect, useState } from "react";
import { Trophy, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionSummary } from "../lib/api";
import * as api from "../lib/api";

interface Props {
  sessionId: string;
}

export function SessionSummaryCard({ sessionId }: Props) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSessionSummary(sessionId)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-text-muted">Generating session summary...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-danger/20">
        <CardContent className="py-6">
          <p className="text-sm text-danger text-center">
            Failed to load summary: {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2 gradient-text")}>
          <Trophy className="w-5 h-5 text-primary shrink-0" />
          Session Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Topics Covered */}
        {summary.topics.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Topics Covered
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.topics.map((t, i) => (
                <Badge key={i} variant="default">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Areas to Improve */}
        {summary.mistakes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Areas to Improve
            </p>
            <ul className="space-y-1">
              {summary.mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                  <span className="text-sm text-text-muted">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* New Vocabulary */}
        {summary.newVocab.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              New Vocabulary
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.newVocab.map((v, i) => (
                <Badge key={i} variant="success">
                  {v}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Encouragement */}
        {summary.encouragement && (
          <div className="flex items-start gap-2 pt-1 border-t border-border">
            <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <p className="text-sm text-accent italic">{summary.encouragement}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
