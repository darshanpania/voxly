import type { Message } from "../lib/api";
import { FeedbackCard } from "./FeedbackCard";

interface Props {
  message: Message;
  showFeedback: boolean;
}

export function MessageBubble({ message, showFeedback }: Props) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`message-row ${isUser ? "message-row--user" : "message-row--assistant"}`}>
      {!isUser && <div className="avatar">S</div>}
      <div className="message-col">
        <div className={`bubble ${isUser ? "bubble--user" : "bubble--assistant"}`}>
          {message.content}
        </div>
        <span className="timestamp">{time}</span>
        {showFeedback && !isUser && message.feedback && (
          <FeedbackCard feedback={message.feedback} />
        )}
      </div>
    </div>
  );
}
