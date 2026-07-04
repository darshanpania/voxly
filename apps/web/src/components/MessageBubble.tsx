import { useState } from "react";
import type { Message, ReplyLine } from "../lib/api";
import { FeedbackCard } from "./FeedbackCard";
import { MessageAudioButton } from "./MessageAudioButton";

interface Props {
  message: Message;
  showFeedback: boolean;
}

function TranslatableLine({ line }: { line: ReplyLine }) {
  // `pinned` is toggled by click/tap and stays until clicked again.
  // `hover` is a desktop-only enhancement that shows on mouse-over.
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const showTranslation = pinned || hover;

  const toggle = () => setPinned((p) => !p);

  return (
    <span
      className="translatable-line select-none cursor-pointer"
      role="button"
      tabIndex={0}
      aria-pressed={pinned}
      aria-label={`Show English translation: ${line.en}`}
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {line.es}
      {showTranslation && (
        <span className="translation-tooltip">{line.en}</span>
      )}
    </span>
  );
}

export function MessageBubble({ message, showFeedback }: Props) {
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
            <TranslatableLine line={line} />
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
