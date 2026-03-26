import type { Message } from "../lib/api";
import { FeedbackCard } from "./FeedbackCard";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "flex items-end gap-2 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
          }}
        >
          S
        </div>
      )}

      {/* Message column */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            "px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "text-white rounded-2xl rounded-br-sm"
              : "bg-bubble-assistant border border-border text-text rounded-2xl rounded-bl-sm",
          )}
          style={
            isUser
              ? {
                  background:
                    "linear-gradient(135deg, var(--color-bubble-user), #3730a3)",
                }
              : undefined
          }
        >
          {message.content}
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
