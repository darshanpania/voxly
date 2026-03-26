import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { ConversationPage } from "./pages/ConversationPage";
import { SessionsPage } from "./pages/SessionsPage";
import { ProgressPage } from "./pages/ProgressPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { MessageCircle, BarChart3, BookOpen, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { to: "/history", label: "History", icon: Clock },
];

function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bg-surface/80 backdrop-blur-xl border-t border-border flex items-stretch shrink-0">
      {navLinks.map(({ to, label, icon: Icon }) => {
        const isActive =
          to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-3 px-2 text-xs transition-colors",
              isActive ? "text-primary" : "text-text-muted hover:text-text",
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="font-medium leading-none">{label}</span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-background text-text">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<ConversationPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionsPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/vocabulary" element={<VocabularyPage />} />
            <Route path="/history" element={<SessionHistoryPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
