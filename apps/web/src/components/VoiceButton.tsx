import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "../lib/api";

type VoiceState = "idle" | "recording" | "processing";

// Auto-stop after this many seconds as a safety cap.
const MAX_RECORDING_SECONDS = 60;

interface Props {
  onTranscript: (transcript: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  language?: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceButton({
  onTranscript,
  onError,
  disabled = false,
  language = "es",
}: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, [clearTimer]);

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
        clearTimer();
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
          onError?.("Couldn't transcribe that. Please try again.");
        } finally {
          setState("idle");
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setElapsed(0);

      // Tick every second; auto-stop at the safety cap.
      clearTimer();
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      // Mic permission denied or otherwise unavailable
      setState("idle");
      const denied =
        err instanceof DOMException && err.name === "NotAllowedError";
      onError?.(
        denied
          ? "Microphone access was denied. Check your browser's mic permission for this site."
          : "Microphone unavailable. Check your browser's mic permission for this site.",
      );
    }
  }, [disabled, state, language, onTranscript, onError, clearTimer, stopRecording]);

  // Clean up timer and any active recording on unmount.
  useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
    };
  }, [clearTimer]);

  if (state === "processing") {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        type="button"
      >
        <Loader2 className="animate-spin" />
        <span>Processing</span>
      </Button>
    );
  }

  if (state === "recording") {
    return (
      <Button
        variant="destructive"
        size="sm"
        className="relative"
        onClick={stopRecording}
        onContextMenu={(e) => e.preventDefault()}
        type="button"
        title="Tap to stop"
      >
        <span className="absolute inset-0 rounded-[inherit] bg-danger/30 animate-pulse" />
        <MicOff />
        <span>{formatElapsed(elapsed)}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={startRecording}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      title="Tap to record"
      type="button"
    >
      <Mic />
      <span>Mic</span>
    </Button>
  );
}
