import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProgressStats, VocabStats } from "../lib/api";
import * as api from "../lib/api";

function VocabChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length < 2) {
    return <p className="chart-empty">Not enough data for a chart yet.</p>;
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
    <svg viewBox={`0 0 ${width} ${height}`} className="vocab-chart">
      {/* Y-axis labels */}
      {yTicks.map((tick) => {
        const y = padding.top + chartH - (tick / yMax) * chartH;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#e0e0e0"
              strokeDasharray="4"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
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
        fill="#666"
      >
        {data[0].date}
      </text>
      <text
        x={width - padding.right}
        y={height - 5}
        textAnchor="end"
        fontSize="11"
        fill="#666"
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

  if (loading) return <div className="loading">Loading progress...</div>;

  return (
    <div className="progress-page">
      <header className="progress-page__header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h2>Progress</h2>
      </header>

      {progress && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-card__value">{progress.sessions_count}</div>
              <div className="stat-card__label">Sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{progress.streak_days}</div>
              <div className="stat-card__label">Day Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{progress.total_minutes}</div>
              <div className="stat-card__label">Minutes</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">
                {vocabStats?.total_words ?? 0}
              </div>
              <div className="stat-card__label">Words Learned</div>
            </div>
          </div>

          {vocabStats && (
            <div className="progress-section">
              <h3>Vocabulary Stats</h3>
              <p>
                {vocabStats.words_mastered} mastered · Avg difficulty:{" "}
                {vocabStats.avg_difficulty.toFixed(1)}
              </p>
              {vocabStats.top_mistakes.length > 0 && (
                <p>
                  Needs practice:{" "}
                  {vocabStats.top_mistakes.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="progress-section">
            <h3>Vocab Growth</h3>
            <VocabChart data={progress.vocab_growth} />
          </div>

          <div className="progress-section">
            <h3>Level History</h3>
            {progress.level_history.length === 0 ? (
              <p>No sessions yet.</p>
            ) : (
              <ul className="level-history">
                {progress.level_history.map((entry, i) => (
                  <li key={i} className="level-history__item">
                    <span className="level-history__date">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <span className="level-history__level">{entry.level}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
