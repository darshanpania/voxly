import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Flame,
  Clock,
  MessageCircle,
  BookOpen,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProgressStats, VocabStats } from "../lib/api";
import * as api from "../lib/api";

function VocabChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">
        Not enough data for a chart yet.
      </p>
    );
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxCount = Math.max(...data.map((d) => d.count));
  const yMax = Math.ceil(maxCount * 1.1) || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - (d.count / yMax) * chartH;
    return `${x},${y}`;
  });

  const yTicks = [0, Math.round(yMax / 2), yMax];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Y-axis labels + grid lines */}
      {yTicks.map((tick) => {
        const y = padding.top + chartH - (tick / yMax) * chartH;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#2a2a40"
              strokeDasharray="4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="#8888a0"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartW;
        const y = padding.top + chartH - (d.count / yMax) * chartH;
        return <circle key={i} cx={x} cy={y} r="3" fill="#6366f1" />;
      })}

      {/* X-axis labels (first and last) */}
      <text
        x={padding.left}
        y={height - 5}
        textAnchor="start"
        fontSize="11"
        fill="#8888a0"
      >
        {data[0].date}
      </text>
      <text
        x={width - padding.right}
        y={height - 5}
        textAnchor="end"
        fontSize="11"
        fill="#8888a0"
      >
        {data[data.length - 1].date}
      </text>
    </svg>
  );
}

export function ProgressPage() {
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [vocabStats, setVocabStats] = useState<VocabStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProgress("es"), api.getVocabStats("es")])
      .then(([p, v]) => {
        setProgress(p);
        setVocabStats(v);
      })
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
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold gradient-text">Progress</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : !progress ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-sm">No progress data yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center py-4">
              <Flame className="w-5 h-5 text-warning mx-auto mb-1" />
              <div className="text-2xl font-bold gradient-text">{progress.streak_days}</div>
              <div className="text-xs text-text-muted mt-1">Day Streak</div>
            </Card>
            <Card className="text-center py-4">
              <Clock className="w-5 h-5 text-accent mx-auto mb-1" />
              <div className="text-2xl font-bold gradient-text">{progress.total_minutes}</div>
              <div className="text-xs text-text-muted mt-1">Minutes</div>
            </Card>
            <Card className="text-center py-4">
              <MessageCircle className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold gradient-text">{progress.sessions_count}</div>
              <div className="text-xs text-text-muted mt-1">Sessions</div>
            </Card>
            <Card className="text-center py-4">
              <BookOpen className="w-5 h-5 text-success mx-auto mb-1" />
              <div className="text-2xl font-bold gradient-text">{vocabStats?.total_words ?? 0}</div>
              <div className="text-xs text-text-muted mt-1">Words Learned</div>
            </Card>
          </div>

          {/* Vocab stats */}
          {vocabStats && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text">Vocabulary Stats</h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-muted">
                  <span className="text-success font-medium">{vocabStats.words_mastered}</span>{" "}
                  mastered
                </span>
                <span className="text-text-muted">
                  Avg difficulty:{" "}
                  <span className="text-text font-medium">
                    {vocabStats.avg_difficulty.toFixed(1)}
                  </span>
                </span>
              </div>
              {vocabStats.top_mistakes.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Needs practice:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vocabStats.top_mistakes.map((word) => (
                      <Badge key={word} variant="danger">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Vocab growth chart */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text">Vocab Growth</h3>
            </div>
            <VocabChart data={progress.vocab_growth} />
          </Card>

          {/* Level history */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-text">Level History</h3>
            </div>
            {progress.level_history.length === 0 ? (
              <p className="text-sm text-text-muted">No sessions yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {progress.level_history.map((entry, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-text-muted">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <Badge variant="default">{entry.level}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
