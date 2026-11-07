import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ConversationPage } from "./pages/ConversationPage";
import { ProgressPage } from "./pages/ProgressPage";
import { PhrasebookPage } from "./pages/PhrasebookPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Redirect legacy /sessions/:id links to the merged /history/:id detail view.
function SessionDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/history/${id}`} replace />;
}

/**
 * Halo layout: the talk screen is home and fills the whole window. The
 * Phrasebook, Progress and History pages open from it and each has a back
 * button, so there is no tab bar.
 */
function AppShell() {
  return (
    <div className="flex flex-col h-[100dvh] bg-background text-text">
      <main className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<ConversationPage />} />
          <Route path="/phrasebook" element={<PhrasebookPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/history" element={<SessionHistoryPage />} />
          <Route path="/history/:id" element={<SessionHistoryPage />} />
          {/* Legacy routes */}
          <Route path="/vocabulary" element={<Navigate to="/phrasebook" replace />} />
          <Route path="/sessions" element={<Navigate to="/history" replace />} />
          <Route path="/sessions/:id" element={<SessionDetailRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background text-text">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <AppShell />;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
