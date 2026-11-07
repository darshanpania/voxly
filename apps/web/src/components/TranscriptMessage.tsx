import type { Message } from "../lib/api";
import { captionLines } from "../lib/language";
import { FeedbackCard } from "./FeedbackCard";
import { MessageAudioButton } from "./MessageAudioButton";
import { LangText, translationOf } from "./halo/LangText";

interface Props {
  message: Message;
  showFeedback: boolean;
  /** Show the English translation under Spanish sentences. */
  showTranslation: boolean;
}

/**
 * One turn in a written transcript (the talk screen's transcript sheet and
 * session history). Color shows the language, not the speaker.
 */
export function TranscriptMessage({ message, showFeedback, showTranslation }: Props) {
  const isUser = message.role === "user";
  const lines = captionLines(message);
  const translation = showTranslation && !isUser ? translationOf(lines) : null;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="flex flex-col gap-1 animate-fade-in">
      <div className="flex items-center justify-between gap-2 min-h-7">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-text-dim">
          {isUser ? "YOU" : "SOFÍA"} · {time}
        </span>
        {!isUser && message.content && <MessageAudioButton text={message.content} />}
      </div>
      <p className="m-0 font-display text-[19px] leading-snug font-medium">
        <LangText lines={lines} />
      </p>
      {translation && (
        <p lang="en" className="m-0 text-sm leading-snug text-en">
          {translation}
        </p>
      )}
      {showFeedback && !isUser && message.feedback && (
        <FeedbackCard feedback={message.feedback} />
      )}
    </article>
  );
}
