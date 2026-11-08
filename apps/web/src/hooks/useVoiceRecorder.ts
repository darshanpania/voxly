import { useState, useRef, useCallback, useEffect } from "react";
import * as api from "../lib/api";

export type VoiceState = "idle" | "recording" | "processing";

// Safety cap on one turn.
const MAX_RECORDING_SECONDS = 60;
// End the turn after this much quiet once the learner has started speaking.
const END_OF_TURN_SILENCE_MS = 1600;
// A hands-free listen gives up (and sends nothing) if nobody speaks in time.
const NO_SPEECH_TIMEOUT_MS = 10_000;
// Minimum RMS level counted as speech. Raised above the measured room noise.
const MIN_SPEECH_RMS = 0.015;
const LEVEL_POLL_MS = 100;

interface Options {
  language: string;
  onTranscript: (transcript: string) => void;
  onError?: (message: string) => void;
}

/**
 * Records one spoken turn and transcribes it. Voxly is voice-only, so the turn
 * ends on its own: after a short silence once the learner has spoken, or when
 * they tap stop. A listen that hears no speech at all times out and sends
 * nothing, because Whisper tends to invent words for silent audio.
 */
export function useVoiceRecorder({ language, onTranscript, onError }: Options) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [heardSpeech, setHeardSpeech] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const heardSpeechRef = useRef(false);
  const discardRef = useRef(false);
  const stateRef = useRef<VoiceState>("idle");

  // Keep the latest callbacks without re-creating start().
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const languageRef = useRef(language);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;
  languageRef.current = language;

  const setVoiceState = (next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  };

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    if (levelTimerRef.current !== null) clearInterval(levelTimerRef.current);
    timerRef.current = null;
    levelTimerRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  /** Finish the turn and send it for transcription. */
  const stop = useCallback(() => {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, [clearTimers]);

  /** Abandon the turn without sending anything. */
  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
  }, [stop]);

  const watchLevels = useCallback(
    (stream: MediaStream) => {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return; // No level data: the learner taps to stop.

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);

      const startedAt = Date.now();
      let noiseFloor = Infinity;
      let lastLoudAt = 0;

      levelTimerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        const rms = Math.sqrt(sum / samples.length);
        const now = Date.now();

        // Learn the room noise during the first half second.
        if (now - startedAt < 500) {
          noiseFloor = Math.min(noiseFloor, rms);
          return;
        }
        const threshold = Math.max(
          MIN_SPEECH_RMS,
          Number.isFinite(noiseFloor) ? noiseFloor * 3 : 0,
        );

        if (rms > threshold) {
          lastLoudAt = now;
          if (!heardSpeechRef.current) {
            heardSpeechRef.current = true;
            setHeardSpeech(true);
          }
        } else if (
          heardSpeechRef.current &&
          now - lastLoudAt > END_OF_TURN_SILENCE_MS
        ) {
          stop();
        } else if (
          !heardSpeechRef.current &&
          now - startedAt > NO_SPEECH_TIMEOUT_MS
        ) {
          cancel();
        }
      }, LEVEL_POLL_MS);
    },
    [stop, cancel],
  );

  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    setVoiceState("recording");
    setElapsed(0);
    setHeardSpeech(false);
    heardSpeechRef.current = false;
    discardRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setVoiceState("idle");
      const denied =
        err instanceof DOMException && err.name === "NotAllowedError";
      onErrorRef.current?.(
        denied
          ? "Microphone access was denied. Check your browser's mic permission for this site."
          : "Microphone unavailable. Check your browser's mic permission for this site.",
      );
      return;
    }

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
      clearTimers();
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      // A tap on stop always sends (the mic may just be quiet). Only the
      // no-speech timeout discards the turn.
      if (discardRef.current || blob.size === 0) {
        setVoiceState("idle");
        return;
      }

      setVoiceState("processing");
      try {
        const { transcript } = await api.transcribeAudio(
          blob,
          languageRef.current,
        );
        setVoiceState("idle");
        if (transcript.trim()) onTranscriptRef.current(transcript.trim());
      } catch {
        setVoiceState("idle");
        onErrorRef.current?.("Couldn't hear that clearly. Please try again.");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    watchLevels(stream);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) stop();
        return next;
      });
    }, 1000);
  }, [clearTimers, watchLevels, stop]);

  // Release the mic if the page unmounts mid-turn.
  useEffect(() => cancel, [cancel]);

  return { state, elapsed, heardSpeech, start, stop, cancel };
}
