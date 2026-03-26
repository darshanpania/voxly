import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchEnd={stopRecording}
        type="button"
        title="Release to stop"
      >
        <span className="absolute inset-0 rounded-[inherit] bg-danger/30 animate-pulse" />
        <MicOff />
        <span>Release</span>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onMouseDown={startRecording}
      onTouchStart={startRecording}
      disabled={disabled}
      title="Hold to record"
      type="button"
    >
      <Mic />
      <span>Mic</span>
    </Button>
  );
}
