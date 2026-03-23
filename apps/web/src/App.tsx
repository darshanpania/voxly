import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConversationPage } from "./pages/ConversationPage";
import { SessionsPage } from "./pages/SessionsPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConversationPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
