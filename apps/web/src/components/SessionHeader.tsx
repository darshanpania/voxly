interface Props {
  difficulty: string;
  mode: string;
  showFeedback: boolean;
  isMuted: boolean;
  onDifficultyChange: (d: string) => void;
  onModeChange: (m: string) => void;
  onFeedbackToggle: () => void;
  onMuteToggle: () => void;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function SessionHeader({
  difficulty,
  mode,
  showFeedback,
  isMuted,
  onDifficultyChange,
  onModeChange,
  onFeedbackToggle,
  onMuteToggle,
}: Props) {
  return (
    <header className="session-header">
      <div className="session-header__title">
        <span className="sofia-badge">S</span>
        <strong>Sofia</strong>
        <span className="session-header__subtitle">Spanish Tutor</span>
      </div>
      <div className="session-header__controls">
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="control-select"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          className={`control-btn ${mode === "immersion" ? "control-btn--active" : ""}`}
          onClick={() =>
            onModeChange(mode === "helper" ? "immersion" : "helper")
          }
        >
          {mode === "helper" ? "Helper" : "Immersion"}
        </button>
        <button
          className={`control-btn ${showFeedback ? "control-btn--active" : ""}`}
          onClick={onFeedbackToggle}
        >
          Feedback {showFeedback ? "ON" : "OFF"}
        </button>
        <button
          className={`control-btn ${isMuted ? "" : "control-btn--active"}`}
          onClick={onMuteToggle}
          title={isMuted ? "Unmute Sofia" : "Mute Sofia"}
        >
          {isMuted ? "Muted" : "Sound ON"}
        </button>
      </div>
    </header>
  );
}
