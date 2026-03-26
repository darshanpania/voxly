import { MessageSquare, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <header className="bg-surface/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
      {/* Left: Sofia identity */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
          <span className="text-white text-sm font-bold leading-none">S</span>
        </div>
        <div className="flex flex-col">
          <span className="text-text font-bold text-sm leading-tight">Sofia</span>
          <span className="text-text-muted text-xs leading-tight">Spanish Tutor</span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Difficulty select */}
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className={cn(
            "bg-surface-2 border border-border rounded-lg px-2 py-1.5",
            "text-sm text-text cursor-pointer",
            "focus:outline-none focus:border-primary/50",
            "transition-colors duration-200",
          )}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        {/* Mode toggle */}
        <Button
          variant={mode === "immersion" ? "default" : "secondary"}
          size="sm"
          onClick={() => onModeChange(mode === "helper" ? "immersion" : "helper")}
        >
          {mode === "immersion" ? "Immersion" : "Helper"}
        </Button>

        {/* Feedback toggle */}
        <Button
          variant={showFeedback ? "default" : "ghost"}
          size="sm"
          onClick={onFeedbackToggle}
          title={showFeedback ? "Disable feedback" : "Enable feedback"}
        >
          <MessageSquare />
          {showFeedback ? "Feedback" : "Feedback"}
        </Button>

        {/* Mute toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMuteToggle}
          title={isMuted ? "Unmute Sofia" : "Mute Sofia"}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>
    </header>
  );
}
