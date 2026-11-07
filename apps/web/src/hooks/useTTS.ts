import { useState, useRef, useCallback, useEffect } from "react";
import * as api from "../lib/api";

/**
 * How a call to `play` finished:
 * - "ended": the audio played to the end
 * - "muted": playback was skipped because Sofía is muted
 * - "interrupted": `stop()` (or a newer `play`) cut it short
 * - "failed": synthesis or playback failed (e.g. autoplay was blocked)
 */
export type PlayResult = "ended" | "muted" | "interrupted" | "failed";

export function useTTS() {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Resolves the promise of the clip that is currently playing.
  const settleRef = useRef<((result: PlayResult) => void) | null>(null);
  // Bumped by every play/stop so a slow synthesis request can tell it is stale.
  const generationRef = useRef(0);

  const releaseCurrent = useCallback((result: PlayResult) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    const settle = settleRef.current;
    settleRef.current = null;
    setIsSpeaking(false);
    settle?.(result);
  }, []);

  /** Speak `text`. Resolves when playback finishes, so callers can chain the next step. */
  const play = useCallback(
    async (text: string, language = "es"): Promise<PlayResult> => {
      if (!text) return "failed";
      if (mutedRef.current) return "muted";

      // A new clip always replaces whatever is playing.
      releaseCurrent("interrupted");
      const generation = ++generationRef.current;
      setIsSpeaking(true);

      let blob: Blob;
      try {
        blob = await api.synthesizeSpeech(text, language);
      } catch {
        if (generation === generationRef.current) setIsSpeaking(false);
        return "failed";
      }
      if (generation !== generationRef.current) return "interrupted";
      if (mutedRef.current) {
        setIsSpeaking(false);
        return "muted";
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      urlRef.current = url;
      audioRef.current = audio;

      return new Promise<PlayResult>((resolve) => {
        settleRef.current = resolve;
        audio.addEventListener("ended", () => {
          if (audioRef.current === audio) releaseCurrent("ended");
        });
        audio.addEventListener("error", () => {
          if (audioRef.current === audio) releaseCurrent("failed");
        });
        audio.play().catch(() => {
          // Autoplay blocked or decode error — non-critical.
          if (audioRef.current === audio) releaseCurrent("failed");
        });
      });
    },
    [releaseCurrent],
  );

  /** Stop speaking right away (e.g. the learner taps the mic to interrupt). */
  const stop = useCallback(() => {
    generationRef.current++;
    releaseCurrent("interrupted");
  }, [releaseCurrent]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    if (next) {
      generationRef.current++;
      releaseCurrent("interrupted");
    }
  }, [releaseCurrent]);

  useEffect(() => () => releaseCurrent("interrupted"), [releaseCurrent]);

  return { play, stop, isMuted, isSpeaking, toggleMute };
}
