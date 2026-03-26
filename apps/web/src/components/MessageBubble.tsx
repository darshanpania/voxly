import { useState } from "react";
import type { Message, ReplyLine } from "../lib/api";
import { FeedbackCard } from "./FeedbackCard";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
  showFeedback: boolean;
}

function TranslatableLine({ line }: { line: ReplyLine }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <span
      className="translatable-line"
      onMouseEnter={() => setShowTranslation(true)}
      onMouseLeave={() => setShowTranslation(false)}
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

        {/* Timestamp */}
        <span className="text-xs text-text-dim mt-1 px-1">{time}</span>

        {/* Feedback card */}
        {showFeedback && !isUser && message.feedback && (
          <FeedbackCard feedback={message.feedback} />
        )}
      </div>
    </div>
  );
}
