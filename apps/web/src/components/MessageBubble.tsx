import { useState } from "react";
import type { Message, ReplyLine } from "../lib/api";
import { FeedbackCard } from "./FeedbackCard";
import { MessageAudioButton } from "./MessageAudioButton";

interface Props {
  message: Message;
  showFeedback: boolean;
  immersion?: boolean;
}

function TranslatableLine({
  line,
  immersion,
}: {
  line: ReplyLine;
  immersion: boolean;
}) {
  // Helper mode: a tap pins the translation; hover previews it on desktop.
  // Immersion mode: translations stay available but need a deliberate
  // two-step reveal — the first tap shows an "EN?" chip, a second tap shows
  // the translation — and hover never bypasses it.
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [hover, setHover] = useState(false);

  const advance = () => {
    setStage((s) => {
      if (!immersion) return s === 2 ? 0 : 2;
      return s === 0 ? 1 : s === 1 ? 2 : 0;
    });
  };

  const showTranslation = stage === 2 || (!immersion && hover);
  const showChip = immersion && stage === 1;

  return (
    <span
      className="translatable-line select-none cursor-pointer"
      role="button"
      tabIndex={0}
      aria-pressed={stage === 2}
      aria-label={
        immersion && stage === 0
          ? "Tap twice to reveal the English translation"
          : `Show English translation: ${line.en}`
      }
      onClick={advance}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
      }}
    >
      {line.es}
      {showChip && (
        <span className="translation-tooltip translation-chip">EN?</span>
      )}
      {showTranslation && (
        <span className="translation-tooltip">{line.en}</span>
      )}
    </span>
  );
}

export function MessageBubble({ message, showFeedback, immersion = false }: Props) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderContent = () => {
    if (isUser || !message.replyLines?.length) {
      return message.content;
    }

    return (
      <span className="translatable-content">
        {message.replyLines.map((line, i) => (
          <span key={i}>
            {i > 0 && " "}
            <TranslatableLine line={line} immersion={immersion} />
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className={`message-row ${isUser ? "message-row--user" : "message-row--assistant"}`}>
      {!isUser && <div className="avatar">S</div>}
      <div className="message-col">
        <div className={`bubble ${isUser ? "bubble--user" : "bubble--assistant"}`}>
          {renderContent()}
        </div>

        {/* Meta row: timestamp + audio replay (assistant only) */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-text-dim">{time}</span>
          {!isUser && <MessageAudioButton text={message.content} />}
        </div>

        {/* Feedback card */}
        {showFeedback && !isUser && message.feedback && (
          <FeedbackCard feedback={message.feedback} />
        )}
      </div>
    </div>
  );
}
