import { Mic, Square, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceState } from "../hooks/useVoiceRecorder";

interface Props {
  state: VoiceState;
  elapsed: number;
  heardSpeech: boolean;
  /** Sofía is thinking (the reply is on its way). */
  busy: boolean;
  /** Sofía is speaking. A tap interrupts her and starts listening. */
  speaking: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** The one control of the voice-only conversation: a large talk button with a status line. */
export function VoiceButton({
  state,
  elapsed,
  heardSpeech,
  busy,
  speaking,
  disabled = false,
  onStart,
  onStop,
}: Props) {
  const recording = state === "recording";
  const processing = state === "processing";
  const waiting = processing || busy;

  const status = recording
    ? heardSpeech
      ? `Listening… ${formatElapsed(elapsed)} · tap to send`
      : "Listening… speak English or Spanish"
    : processing
      ? "Catching that…"
      : busy
        ? "Sofia is thinking…"
        : speaking
          ? "Sofia is speaking · tap to interrupt"
          : disabled
            ? ""
            : "Tap and talk";

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled || waiting}
        aria-label={recording ? "Stop and send" : "Talk to Sofia"}
        className={cn(
          "relative w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "disabled:opacity-50 disabled:cursor-not-allowed active:scale-95",
          recording ? "bg-danger" : "bg-primary",
        )}
      >
        {recording && (
          <span className="absolute inset-0 rounded-full bg-danger/40 animate-ping" />
        )}
        {recording ? (
          <Square size={22} className="relative" />
        ) : waiting ? (
          <Loader2 size={26} className="animate-spin" />
        ) : speaking ? (
          <Volume2 size={26} className="animate-pulse" />
        ) : (
          <Mic size={26} />
        )}
      </button>
      <span className="text-text-muted text-xs h-4 truncate max-w-full" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
