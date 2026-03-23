import { useState, useRef, useCallback } from "react";
import * as api from "../lib/api";

export function useTTS() {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const play = useCallback(
    async (text: string, language = "es") => {
      if (isMuted || !text) return;

      try {
        const blob = await api.synthesizeSpeech(text, language);

        // Revoke previous URL to avoid memory leaks
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        if (audioRef.current) {
          audioRef.current.pause();
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.addEventListener("ended", () => {
          URL.revokeObjectURL(url);
          urlRef.current = null;
        });
        await audio.play();
      } catch {
        // TTS failure is non-critical — don't disrupt the conversation
      }
    },
    [isMuted],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (!prev && audioRef.current) {
        audioRef.current.pause();
      }
      return !prev;
    });
  }, []);

  return { play, isMuted, toggleMute };
}
