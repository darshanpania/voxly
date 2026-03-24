import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { ConversationPage } from "./pages/ConversationPage";
import { SessionsPage } from "./pages/SessionsPage";
import { ProgressPage } from "./pages/ProgressPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { SessionHistoryPage } from "./pages/SessionHistoryPage";

function NavBar() {
  const location = useLocation();
  const links = [
    { to: "/", label: "Chat" },
    { to: "/progress", label: "Progress" },
    { to: "/vocabulary", label: "Vocabulary" },
    { to: "/history", label: "History" },
  ];

  return (
    <nav className="navbar">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={`navbar__link${location.pathname === link.to ? " navbar__link--active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<ConversationPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/history" element={<SessionHistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
