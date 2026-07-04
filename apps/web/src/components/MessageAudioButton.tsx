import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import * as api from "../lib/api";

type PlayState = "idle" | "loading" | "playing";

// Available playback speeds, toggled in order. Persisted so the choice
// sticks across messages (and reloads).
const SPEEDS = [1, 0.75] as const;
const SPEED_KEY = "voxly.ttsPlaybackRate";

function loadSpeed(): number {
  try {
    const stored = Number(localStorage.getItem(SPEED_KEY));
    if (SPEEDS.includes(stored as (typeof SPEEDS)[number])) return stored;
  } catch {
    // localStorage unavailable — fall through to default
  }
  return 1;
}

// Module-level cache so every button shares (and persists) the speed choice.
let currentSpeed = loadSpeed();

interface Props {
  text: string;
}

export function MessageAudioButton({ text }: Props) {
  const [state, setState] = useState<PlayState>("idle");
  const [speed, setSpeed] = useState(currentSpeed);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const cleanupUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    cleanupUrl();
    setState("idle");
  }, [cleanupUrl]);

  const play = useCallback(async () => {
    if (state === "playing") {
      stop();
      return;
    }
    if (state === "loading" || !text) return;

    setState("loading");
    try {
      // Reuse the cached blob so replays don't re-bill OpenAI.
      let blob = blobRef.current;
      if (!blob) {
        blob = await api.synthesizeSpeech(text, "es");
        blobRef.current = blob;
      }

      cleanupUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audio.playbackRate = currentSpeed;
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        cleanupUrl();
        audioRef.current = null;
        setState("idle");
      });
      await audio.play();
      setState("playing");
    } catch {
      // Silent-fail — return to idle so the user can retry.
      cleanupUrl();
      audioRef.current = null;
      setState("idle");
    }
  }, [state, text, stop, cleanupUrl]);

  const toggleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    currentSpeed = next;
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_KEY, String(next));
    } catch {
      // localStorage unavailable — keep the in-memory choice
    }
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  // Stop audio and release resources on unmount.
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={play}
        disabled={state === "loading"}
        className="text-text-dim hover:text-text transition-colors disabled:opacity-50"
        title={state === "playing" ? "Stop" : "Play audio"}
        aria-label={state === "playing" ? "Stop audio" : "Play audio"}
      >
        {state === "loading" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state === "playing" ? (
          <Square size={14} />
        ) : (
          <Volume2 size={14} />
        )}
      </button>
      <button
        type="button"
        onClick={toggleSpeed}
        className="text-xs text-text-dim hover:text-text transition-colors tabular-nums"
        title="Playback speed"
        aria-label={`Playback speed ${speed}x`}
      >
        {speed}×
      </button>
    </span>
  );
}
