import { useEffect, useRef, useState } from "react";
import { MessageSquare, MoreVertical, Volume2, VolumeX } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss the overflow menu when clicking outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const toggleMode = () =>
    onModeChange(mode === "helper" ? "immersion" : "helper");

  return (
    <header className="bg-surface/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between gap-2">
      {/* Left: Sofia identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
          <span className="text-white text-sm font-bold leading-none">S</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-text font-bold text-sm leading-tight truncate">
            Sofia
          </span>
          <span className="text-text-muted text-xs leading-tight hidden min-[400px]:block">
            Spanish Tutor
          </span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Difficulty select — always visible */}
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className={cn(
            "bg-surface-2 border border-border rounded-lg px-2 h-10 sm:h-8",
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

        {/* Mode toggle — inline at sm and above */}
        <Button
          variant={mode === "immersion" ? "default" : "secondary"}
          size="sm"
          className="hidden sm:inline-flex"
          onClick={toggleMode}
        >
          {mode === "immersion" ? "Immersion" : "Helper"}
        </Button>

        {/* Feedback toggle — inline at sm and above */}
        <Button
          variant={showFeedback ? "default" : "ghost"}
          size="sm"
          className="hidden sm:inline-flex"
          onClick={onFeedbackToggle}
          title={showFeedback ? "Disable feedback" : "Enable feedback"}
        >
          <MessageSquare />
          Feedback
        </Button>

        {/* Mute toggle — always visible */}
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 px-0 sm:h-8 sm:w-8"
          onClick={onMuteToggle}
          title={isMuted ? "Unmute Sofia" : "Mute Sofia"}
        >
          {isMuted ? <VolumeX /> : <Volume2 />}
        </Button>

        {/* Overflow menu — only below sm; holds Mode + Feedback */}
        <div ref={menuRef} className="relative sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 px-0"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="More options"
          >
            <MoreVertical />
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-border bg-surface-2 p-1.5 shadow-lg">
              <Button
                variant={mode === "immersion" ? "default" : "secondary"}
                className="w-full justify-start min-h-10"
                onClick={() => {
                  toggleMode();
                  setMenuOpen(false);
                }}
              >
                {mode === "immersion" ? "Immersion" : "Helper"}
              </Button>
              <Button
                variant={showFeedback ? "default" : "ghost"}
                className="mt-1 w-full justify-start min-h-10"
                onClick={() => {
                  onFeedbackToggle();
                  setMenuOpen(false);
                }}
              >
                <MessageSquare />
                {showFeedback ? "Feedback on" : "Feedback off"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
