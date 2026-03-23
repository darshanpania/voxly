import { useState, useRef, useCallback } from "react";
import * as api from "../lib/api";

type VoiceState = "idle" | "recording" | "processing";

interface Props {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  language?: string;
}

export function VoiceButton({
  onTranscript,
  disabled = false,
  language = "es",
}: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (disabled || state !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the mic
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        if (blob.size === 0) {
          setState("idle");
          return;
        }

        setState("processing");
        try {
          const { transcript } = await api.transcribeAudio(blob, language);
          if (transcript.trim()) {
            onTranscript(transcript.trim());
          }
        } catch {
          // Transcription failure — user can retry
        } finally {
          setState("idle");
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch {
      // Mic permission denied or unavailable
      setState("idle");
    }
  }, [disabled, state, language, onTranscript]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const label =
    state === "recording"
      ? "Release"
      : state === "processing"
        ? "..."
        : "Mic";

  return (
    <button
      className={`voice-btn voice-btn--${state}`}
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onMouseLeave={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={disabled || state === "processing"}
      title="Hold to record"
      type="button"
    >
      {state === "processing" ? (
        <span className="voice-btn__spinner" />
      ) : (
        <svg
          className="voice-btn__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
      <span className="voice-btn__label">{label}</span>
    </button>
  );
}
