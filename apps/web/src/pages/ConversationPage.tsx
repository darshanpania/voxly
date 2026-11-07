import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Bookmark,
  Loader2,
  Mic,
  Plus,
  Repeat2,
  ScrollText,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { TranscriptMessage } from "../components/TranscriptMessage";
import { Halo, type HaloMode } from "../components/halo/Halo";
import { EnglishNote, LangText, translationOf } from "../components/halo/LangText";
import { Sheet } from "../components/halo/Sheet";
import { TalkSettings } from "../components/halo/TalkSettings";
import { useTTS, type PlayResult } from "../hooks/useTTS";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Message, MessageFeedback } from "../lib/api";
import * as api from "../lib/api";
import {
  captionLines,
  dominantLang,
  langName,
  type CaptionLine,
  type Lang,
} from "../lib/language";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LANGUAGE = "es";
const ACTIVE_SESSION_KEY = "voxly:activeSession";
const HANDS_FREE_KEY = "voxly:handsFree";
const SHOW_ENGLISH_KEY = "voxly:showEnglish";

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Non-critical preference.
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Temp ids for the optimistic bubbles shown while a reply streams in (#20).
const PENDING_USER_ID = "pending-user";
const PENDING_ASSISTANT_ID = "pending-assistant";

/** "SPANISH", "ENGLISH" or "SPANISH + ENGLISH" for a caption label. */
function languagesLabel(lines: CaptionLine[]): string {
  const langs = new Set<Lang>();
  for (const line of lines) for (const seg of line.segments) langs.add(seg.lang);
  if (langs.size > 1) return "SPANISH + ENGLISH";
  return langs.has("en") ? "ENGLISH" : "SPANISH";
}

/** Caption size steps down as the line gets longer, so it always fits. */
function captionSize(lines: CaptionLine[]): string {
  const length = lines.reduce(
    (n, l) => n + l.segments.reduce((m, s) => m + s.text.length, 0),
    0,
  );
  if (length <= 60) return "text-[28px] leading-[1.2]";
  if (length <= 120) return "text-[24px] leading-[1.25]";
  if (length <= 200) return "text-[21px] leading-[1.3]";
  return "text-[19px] leading-[1.35]";
}

const ROUND_BUTTON =
  "flex flex-col items-center gap-2 bg-transparent border-0 p-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45";
const SMALL_CIRCLE =
  "h-14 w-14 rounded-full bg-surface border border-border flex items-center justify-center text-text";
const HEADER_ICON =
  "relative h-11 w-11 rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors";

/** Compact fixes and saved words under the current caption. */
function FeedbackStrip({ feedback }: { feedback: MessageFeedback }) {
  const fix = feedback.corrections?.[0];
  const words = feedback.vocabNotes ?? [];
  if (!fix && words.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm">
      {fix && (
        <div className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-text-dim">FIX</span>
            <s lang="es" className="text-danger decoration-2">{fix.original}</s>
            <span className="text-text-dim" aria-label="becomes">→</span>
            <span lang="es" className="text-es font-semibold">{fix.corrected}</span>
          </span>
          {fix.explanation && (
            <EnglishNote text={fix.explanation} className="leading-snug" />
          )}
        </div>
      )}
      {words.length > 0 && (
        <Link
          to="/phrasebook"
          className="flex items-center gap-2 text-text-muted hover:text-text min-h-6"
        >
          <Bookmark className="w-3.5 h-3.5 shrink-0 text-es" fill="currentColor" aria-hidden="true" />
          <span>
            Saved:{" "}
            {words.map((w, i) => (
              <span key={w.word}>
                {i > 0 && ", "}
                <span lang="es" className="text-es font-medium">{w.word}</span>
              </span>
            ))}
          </span>
        </Link>
      )}
    </div>
  );
}

export function ConversationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [difficulty, setDifficulty] = useState("A1");
  const [mode, setMode] = useState("helper");
  const [showFeedback, setShowFeedback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [levelBanner, setLevelBanner] = useState<{ direction: "up" | "down"; targetLevel: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<{ type: "level" | "mode"; value: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [showEnglish, setShowEnglish] = useState(() => loadFlag(SHOW_ENGLISH_KEY));
  // Immersion mode hides the English until the learner asks for this message.
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const consecutiveSignalRef = useRef<{ signal: string; count: number }>({ signal: "", count: 0 });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const tts = useTTS();
  // Hands-free: after Sofía finishes speaking, start listening again on our own.
  const [handsFree, setHandsFree] = useState(() => loadFlag(HANDS_FREE_KEY));
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const sessionEndedRef = useRef(sessionEnded);
  sessionEndedRef.current = sessionEnded;

  // --- Session bootstrap: resume an active session, else eagerly create one so
  // Sofía greets first (#9, #16). Guarded against StrictMode double-invocation.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void initConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Words due today, for the badge on the Phrasebook button. Refreshed when a
  // session ends, because a session usually adds new words.
  useEffect(() => {
    api
      .getVocabulary(LANGUAGE)
      .then((items) => setDueCount(items.length))
      .catch(() => {});
  }, [sessionEnded]);

  // Open the transcript at the latest turn.
  useEffect(() => {
    if (transcriptOpen) transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [transcriptOpen, messages]);

  async function initConversation() {
    setInitializing(true);

    // 1. Attempt to resume the last active, unfinished session (#9).
    const savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (savedId) {
      try {
        const session = await api.getSession(savedId);
        if (session && !session.endedAt) {
          setSessionId(session.id);
          setDifficulty(session.difficulty);
          setMode(session.mode);
          setMessages(session.messages ?? []);
          setInitializing(false);
          return;
        }
      } catch {
        // fall through to a fresh session
      }
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }

    // 2. Initialize the level from the persisted profile (#8).
    let level = "A1";
    try {
      const profile = await api.getProfile(LANGUAGE);
      level = profile.currentLevel || "A1";
    } catch {
      // keep the A1 default on failure
    }
    setDifficulty(level);

    // 3. Eagerly create a session so Sofía speaks first (#16).
    await startSession(level, mode);
  }

  // Create a fresh session and load its canned greeting into the view (#16).
  async function startSession(level: string, sessionMode: string) {
    setInitializing(true);
    setError(null);
    try {
      const session = await api.createSession({
        language: LANGUAGE,
        difficulty: level,
        mode: sessionMode,
      });
      setSessionId(session.id);
      setMessages(session.messages ?? []);
      localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
      const greeting = session.messages?.[0];
      if (greeting) void speakThenListen(greeting.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInitializing(false);
    }
  }

  function resetConversationState() {
    setMessages([]);
    setError(null);
    setSessionEnded(false);
    setLevelBanner(null);
    setPendingChange(null);
    setRevealedId(null);
    consecutiveSignalRef.current = { signal: "", count: 0 };
    clearTimeout(bannerTimerRef.current);
  }

  // Reuse the already-created session; only create as a fallback (#16).
  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const session = await api.createSession({
      language: LANGUAGE,
      difficulty,
      mode,
    });
    setSessionId(session.id);
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);
    if (session.messages && session.messages.length > 0) {
      setMessages((prev) => [...session.messages!, ...prev]);
    }
    return session.id;
  };

  // Speak Sofía's line, then (hands-free) open the mic for the learner's turn.
  // Muted counts as "done speaking" so a hands-free reader can still answer.
  async function speakThenListen(text: string) {
    const result: PlayResult = await tts.play(text);
    if (
      (result === "ended" || result === "muted") &&
      handsFreeRef.current &&
      !sessionEndedRef.current
    ) {
      void voice.start();
    }
  }

  // Voice-only: every turn is a transcript, sent as soon as it arrives.
  const handleSend = async (spoken: string) => {
    const text = spoken.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);

    try {
      const sid = await ensureSession();

      // Show optimistic bubbles immediately: the user's message and an empty
      // assistant bubble that fills in as tokens stream (#20).
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: PENDING_USER_ID, sessionId: sid, role: "user", content: text, createdAt: now },
        { id: PENDING_ASSISTANT_ID, sessionId: sid, role: "assistant", content: "", createdAt: now },
      ]);

      const res = await api.sendMessageStream(sid, text, (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === PENDING_ASSISTANT_ID
              ? { ...m, content: m.content + delta }
              : m,
          ),
        );
      });

      // Swap both temp bubbles for the persisted messages in one update.
      setMessages((prev) => [
        ...prev.filter(
          (m) => m.id !== PENDING_USER_ID && m.id !== PENDING_ASSISTANT_ID,
        ),
        res.userMessage,
        { ...res.assistantMessage, feedback: res.feedback, replyLines: res.assistantMessage.replyLines },
      ]);
      if (res.feedback?.vocabNotes?.length) {
        setDueCount((n) => n + res.feedback!.vocabNotes.length);
      }

      // Track consecutive difficulty signals for level-up/down suggestions
      const signal = res.difficulty_signal;
      if (signal && signal !== "on_track") {
        const prev = consecutiveSignalRef.current;
        if (prev.signal === signal) {
          prev.count += 1;
        } else {
          consecutiveSignalRef.current = { signal, count: 1 };
        }

        const { count } = consecutiveSignalRef.current;
        if (count >= 3 && !res.feedback?.awaitingCorrection) {
          const currentIdx = CEFR_LEVELS.indexOf(difficulty);
          if (signal === "too_easy" && currentIdx < CEFR_LEVELS.length - 1) {
            setLevelBanner({ direction: "up", targetLevel: CEFR_LEVELS[currentIdx + 1] });
          } else if (signal === "too_hard" && currentIdx > 0) {
            setLevelBanner({ direction: "down", targetLevel: CEFR_LEVELS[currentIdx - 1] });
          }
          // Auto-dismiss after 30 seconds
          clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setLevelBanner(null), 30_000);
        }
      } else {
        consecutiveSignalRef.current = { signal: "", count: 0 };
      }

      // Speak the reply, then hand the turn back to the learner.
      void speakThenListen(res.assistantMessage.content);
    } catch (err) {
      // Drop the optimistic bubbles; the learner can simply say it again.
      setMessages((prev) =>
        prev.filter(
          (m) => m.id !== PENDING_USER_ID && m.id !== PENDING_ASSISTANT_ID,
        ),
      );
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // The app is voice-only, so a transcript is sent straight away. Sofía is
  // told the text is speech-to-text and to allow for recognition errors.
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const handleTranscript = useCallback((transcript: string) => {
    void handleSendRef.current(transcript);
  }, []);

  const voice = useVoiceRecorder({
    language: LANGUAGE,
    onTranscript: handleTranscript,
    onError: setError,
  });

  // Tapping the mic while Sofía talks cuts her off and starts listening.
  const handleTalk = () => {
    setError(null);
    tts.stop();
    void voice.start();
  };

  const toggleHandsFree = () => {
    setHandsFree((prev) => {
      const next = !prev;
      saveFlag(HANDS_FREE_KEY, next);
      if (!next) voice.cancel();
      return next;
    });
  };

  const toggleShowEnglish = () => {
    setShowEnglish((prev) => {
      saveFlag(SHOW_ENGLISH_KEY, !prev);
      return !prev;
    });
  };

  const handleEndSession = async () => {
    voice.cancel();
    tts.stop();
    if (sessionId) {
      api.endSession(sessionId).catch(() => {});
      setSessionEnded(true);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  };

  const handleNewSession = async () => {
    voice.cancel();
    tts.stop();
    resetConversationState();
    setSessionId(null);
    await startSession(difficulty, mode);
  };

  // Apply a level/mode change: close the old session, persist level, and start
  // fresh with the new settings (#8, #17). Assumes any needed confirmation has
  // already been obtained.
  async function applyChange(type: "level" | "mode", value: string) {
    const oldSessionId = sessionId;
    const newLevel = type === "level" ? value : difficulty;
    const newMode = type === "mode" ? value : mode;

    voice.cancel();
    tts.stop();

    // Close the abandoned session server-side so empty sessions don't linger.
    if (oldSessionId) {
      api.endSession(oldSessionId).catch(() => {});
    }

    if (type === "level") {
      setDifficulty(value);
      // Level is persisted only via the profile now (#8).
      api.updateProfileLevel(LANGUAGE, value).catch(() => {});
    } else {
      setMode(value);
    }

    resetConversationState();
    setSessionId(null);
    await startSession(newLevel, newMode);
  }

  const hasUserMessage = messages.some((m) => m.role === "user");

  // Level/mode change destroys the current conversation — confirm first if the
  // learner has actually said something (#17).
  const requestChange = (type: "level" | "mode", value: string) => {
    if (type === "level" && value === difficulty) return;
    if (type === "mode" && value === mode) return;
    setSettingsOpen(false);
    if (hasUserMessage) {
      setPendingChange({ type, value });
      return;
    }
    void applyChange(type, value);
  };

  const confirmPendingChange = () => {
    if (!pendingChange) return;
    const { type, value } = pendingChange;
    setPendingChange(null);
    void applyChange(type, value);
  };

  const handleLevelBannerConfirm = () => {
    if (levelBanner) {
      const target = levelBanner.targetLevel;
      setLevelBanner(null);
      // The banner button is itself explicit confirmation — apply directly (#17).
      void applyChange("level", target);
    }
  };

  // --- What the screen shows ---------------------------------------------

  // The empty streaming bubble stays hidden until its first token arrives (#20).
  const visible = useMemo(
    () =>
      messages.filter(
        (m) => !(m.id === PENDING_ASSISTANT_ID && m.content.length === 0),
      ),
    [messages],
  );
  const main = visible[visible.length - 1];
  const previous = visible[visible.length - 2];
  const mainLines = useMemo(() => (main ? captionLines(main) : []), [main]);
  const previousLines = useMemo(
    () => (previous ? captionLines(previous) : []),
    [previous],
  );
  const lastAssistant = [...visible].reverse().find((m) => m.role === "assistant");
  const speakingLang: Lang = useMemo(
    () => (lastAssistant ? dominantLang(captionLines(lastAssistant)) : "es"),
    [lastAssistant],
  );
  const awaitingCorrection = lastAssistant?.feedback?.awaitingCorrection;

  const recording = voice.state === "recording";
  const processing = voice.state === "processing";
  const waiting = processing || loading;
  const preparing = initializing && messages.length === 0;
  const talkDisabled = sessionEnded || initializing || !sessionId || waiting;

  let haloMode: HaloMode = "idle";
  let haloTone: Lang | "neutral" = "neutral";
  if (preparing || waiting) haloMode = "thinking";
  else if (recording) haloMode = "listening";
  else if (tts.isSpeaking) {
    haloMode = "speaking";
    haloTone = speakingLang;
  }

  const status = sessionEnded
    ? "Session ended"
    : preparing
      ? "Sofía is getting ready…"
      : recording
        ? voice.heardSpeech
          ? `Listening · ${formatElapsed(voice.elapsed)} · tap Done when you finish`
          : "Listening · speak English or Spanish"
        : processing
          ? "Catching that…"
          : loading
            ? "Sofía is thinking…"
            : tts.isSpeaking
              ? `Sofía is speaking ${langName(speakingLang)}`
              : handsFree
                ? "Your turn · tap Talk to start"
                : "Tap Talk when you are ready";
  const statusDot =
    tts.isSpeaking && !recording
      ? speakingLang === "es"
        ? "bg-es"
        : "bg-en"
      : recording
        ? "bg-text animate-pulse"
        : "bg-text-dim";

  const mainIsSofia = main?.role === "assistant";
  const translation = mainIsSofia ? translationOf(mainLines) : null;
  const translationHidden = mode === "immersion" && revealedId !== main?.id;
  const showHint = !hasUserMessage && !sessionEnded && !error && !preparing;

  const talkLabel = recording
    ? voice.heardSpeech
      ? "Done"
      : "Listening…"
    : waiting
      ? "Wait…"
      : tts.isSpeaking
        ? "Interrupt"
        : "Talk";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 w-full max-w-[560px] mx-auto flex flex-col px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        {/* Header: who you are talking to, and the few things you might need */}
        <header className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              aria-hidden="true"
              className="h-10 w-10 shrink-0 rounded-full bg-surface border border-border flex items-center justify-center font-display text-[17px] font-semibold text-es"
            >
              S
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-display text-[17px] font-semibold leading-tight">Sofía</span>
              <span className="text-xs text-text-muted leading-tight truncate">
                {difficulty} · {mode === "immersion" ? "immersion" : "helper"} ·{" "}
                {handsFree ? "hands-free" : "tap to talk"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              className={HEADER_ICON}
              onClick={() => setTranscriptOpen(true)}
              aria-label="Transcript"
              title="Transcript"
            >
              <ScrollText className="w-[21px] h-[21px]" />
            </button>
            <Link
              to="/phrasebook"
              className={HEADER_ICON}
              aria-label={dueCount > 0 ? `Phrasebook, ${dueCount} to practice` : "Phrasebook"}
              title="Phrasebook"
            >
              <BookOpen className="w-[21px] h-[21px]" />
              {dueCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-es text-background text-[10px] font-bold flex items-center justify-center"
                >
                  {dueCount > 99 ? "99+" : dueCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              className={HEADER_ICON}
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
            >
              <SlidersHorizontal className="w-[21px] h-[21px]" />
            </button>
          </div>
        </header>

        {/* Status: what is happening right now */}
        <div className="flex justify-center mt-4 shrink-0">
          <div
            aria-live="polite"
            className="inline-flex items-center gap-2 max-w-full px-3.5 py-1.5 rounded-full bg-surface border border-border text-[13px] font-medium"
          >
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", statusDot)} />
            <span className="truncate">{status}</span>
          </div>
        </div>

        {sessionEnded ? (
          <div className="flex-1 min-h-0 overflow-y-auto mt-5 flex flex-col gap-4">
            {sessionId && <SessionSummaryCard sessionId={sessionId} />}
            <Link
              to="/phrasebook"
              className="self-center inline-flex items-center gap-2 h-11 px-4 rounded-full border border-border text-sm font-medium hover:bg-surface-2"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              Open your Phrasebook
            </Link>
          </div>
        ) : (
          <>
            {/* The halo takes whatever height is left, so captions never get cut */}
            <div className="flex-1 min-h-0 flex items-center justify-center py-4">
              <Halo mode={haloMode} tone={haloTone} levelRef={voice.levelRef} />
            </div>

            <section
              aria-label="Captions"
              className="shrink-0 max-h-[42dvh] overflow-y-auto text-center px-1"
            >
              {previous && (
                <p className="m-0 mb-3 text-sm leading-snug text-text-muted line-clamp-2">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-text-dim mr-1.5">
                    {previous.role === "user" ? "YOU" : "SOFÍA"}
                  </span>
                  <LangText lines={previousLines} className="opacity-80" />
                </p>
              )}

              {main && (
                <>
                  <span
                    className={cn(
                      "block text-[11px] font-semibold tracking-[0.12em] mb-2",
                      dominantLang(mainLines) === "es" ? "text-es" : "text-en",
                    )}
                  >
                    {mainIsSofia ? "SOFÍA" : "YOU"} · {languagesLabel(mainLines)}
                  </span>
                  <p
                    className={cn(
                      "m-0 font-display font-semibold text-balance",
                      captionSize(mainLines),
                    )}
                  >
                    <LangText lines={mainLines} />
                  </p>

                  {showEnglish && translation && (
                    translationHidden ? (
                      <button
                        type="button"
                        onClick={() => setRevealedId(main.id)}
                        className="mt-2 h-11 px-4 rounded-full text-sm font-medium text-en hover:bg-surface-2"
                      >
                        Show English
                      </button>
                    ) : (
                      <p lang="en" className="m-0 mt-2.5 text-[15px] leading-snug text-en">
                        {translation}
                      </p>
                    )
                  )}

                  {showFeedback && mainIsSofia && main.feedback && (
                    <FeedbackStrip feedback={main.feedback} />
                  )}
                </>
              )}
            </section>
          </>
        )}

        {/* Notes that need the learner: errors, confirmations, level tips */}
        <div className="shrink-0 flex flex-col gap-2 mt-4 empty:hidden">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-danger/40 bg-surface px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          {pendingChange && (
            <div className="animate-fade-in rounded-2xl border border-border bg-surface p-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-text-muted">
                {pendingChange.type === "level"
                  ? `Switch to ${pendingChange.value}? This starts a new conversation.`
                  : `Switch to ${pendingChange.value === "immersion" ? "Immersion" : "Helper"}? This starts a new conversation.`}
              </span>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={confirmPendingChange}>
                  Switch
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingChange(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {levelBanner && !awaitingCorrection && (
            <div className="animate-fade-in rounded-2xl border border-border bg-surface p-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-text-muted">
                {levelBanner.direction === "up"
                  ? `You’re doing great. Try ${levelBanner.targetLevel}?`
                  : `This seems hard. Try ${levelBanner.targetLevel}?`}
              </span>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" onClick={handleLevelBannerConfirm}>
                  {levelBanner.direction === "up" ? "Level up" : "Level down"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLevelBanner(null)}>
                  Not now
                </Button>
              </div>
            </div>
          )}

          {showHint && (
            <p className="m-0 rounded-2xl border border-border bg-surface px-4 py-3 text-center text-sm leading-snug text-text-muted">
              Stuck? Ask in <span className="text-en font-semibold">English</span> anytime:
              “How do I say…?” or “What does … mean?”
            </p>
          )}
        </div>

        {/* Controls: end, talk, repeat */}
        <div className="shrink-0 mt-5 flex items-end justify-between px-3">
          {sessionEnded ? (
            <button type="button" className={ROUND_BUTTON} onClick={handleNewSession}>
              <span className={SMALL_CIRCLE}>
                <Plus className="w-[22px] h-[22px]" aria-hidden="true" />
              </span>
              <span className="text-[13px] text-text-muted">New</span>
            </button>
          ) : (
            <button
              type="button"
              className={ROUND_BUTTON}
              onClick={handleEndSession}
              disabled={!sessionId}
            >
              <span className={SMALL_CIRCLE}>
                <X className="w-[22px] h-[22px]" aria-hidden="true" />
              </span>
              <span className="text-[13px] text-text-muted">End</span>
            </button>
          )}

          <button
            type="button"
            className={ROUND_BUTTON}
            onClick={recording ? voice.stop : handleTalk}
            onContextMenu={(e) => e.preventDefault()}
            disabled={talkDisabled}
          >
            <span className="relative h-[84px] w-[84px] rounded-full bg-text text-background flex items-center justify-center">
              {recording && (
                <span aria-hidden="true" className="talk-ring absolute inset-0 rounded-full border-2 border-text" />
              )}
              {recording ? (
                <Square className="w-6 h-6" fill="currentColor" aria-hidden="true" />
              ) : waiting ? (
                <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
              ) : tts.isSpeaking ? (
                <Square className="w-6 h-6" fill="currentColor" aria-hidden="true" />
              ) : (
                <Mic className="w-7 h-7" aria-hidden="true" />
              )}
            </span>
            <span className="text-[13px] font-semibold text-text">{talkLabel}</span>
          </button>

          <button
            type="button"
            className={ROUND_BUTTON}
            onClick={() => lastAssistant && void speakThenListen(lastAssistant.content)}
            disabled={!lastAssistant || sessionEnded || waiting || recording || tts.isSpeaking}
          >
            <span className={SMALL_CIRCLE}>
              <Repeat2 className="w-[22px] h-[22px]" aria-hidden="true" />
            </span>
            <span className="text-[13px] text-text-muted">Repeat</span>
          </button>
        </div>
      </div>

      <TalkSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        level={difficulty}
        onLevelChange={(l) => requestChange("level", l)}
        mode={mode}
        onModeChange={(m) => requestChange("mode", m)}
        handsFree={handsFree}
        onHandsFreeToggle={toggleHandsFree}
        muted={tts.isMuted}
        onMuteToggle={tts.toggleMute}
        showEnglish={showEnglish}
        onShowEnglishToggle={toggleShowEnglish}
        showFeedback={showFeedback}
        onShowFeedbackToggle={() => setShowFeedback((v) => !v)}
      />

      <Sheet open={transcriptOpen} onClose={() => setTranscriptOpen(false)} title="Transcript">
        <p className="m-0 mb-4 text-[13px] text-text-muted">
          <span className="text-es font-semibold">Amber</span> is Spanish.{" "}
          <span className="text-en font-semibold">Blue</span> is English.
        </p>
        <div className="flex flex-col gap-5">
          {visible.map((m) => (
            <TranscriptMessage
              key={m.id}
              message={m}
              showFeedback={showFeedback}
              showTranslation={showEnglish}
            />
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </Sheet>
    </div>
  );
}
