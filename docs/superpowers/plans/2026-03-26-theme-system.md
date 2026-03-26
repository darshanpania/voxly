# Light/Dark/System Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark/system theme toggle to Voxly with a top nav bar.

**Architecture:** CSS variable overrides on `:root` via `.light`/`.dark` classes. A React context manages the active theme (`light` | `dark` | `system`), persists to `localStorage`, and listens to `prefers-color-scheme` for system mode. A top bar houses the toggle.

**Tech Stack:** React context, CSS custom properties, localStorage, `prefers-color-scheme` media query, Lucide icons (Sun, Moon, Monitor).

---

### Task 1: ThemeContext — provider, hook, and HTML class management

**Files:**
- Create: `apps/web/src/context/ThemeContext.tsx`

- [ ] **Step 1: Create ThemeContext with provider and hook**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("voxly-theme") as Theme | null;
    return stored ?? "system";
  });

  const resolved = theme === "system" ? getSystemTheme() : theme;

  const setTheme = (t: Theme) => {
    localStorage.setItem("voxly-theme", t);
    setThemeState(t);
  };

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }, [resolved]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") setThemeState("system"); // force re-render
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/context/ThemeContext.tsx
git commit -m "feat: add ThemeContext with light/dark/system support"
```

---

### Task 2: CSS variable overrides for light and dark themes

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Keep `@theme` block as-is (dark defaults), add `.light` and `.dark` overrides after it**

Add after the closing `}` of the `@theme` block (line 44):

```css
/* Theme overrides — dark is the @theme default, light overrides below */
:root.light {
  --color-background: #f5f5f7;
  --color-surface: #ffffff;
  --color-surface-2: #f0f0f3;
  --color-surface-3: #e8e8ed;
  --color-border: #d1d1d6;
  --color-border-bright: #b0b0be;
  --color-text: #1c1c1e;
  --color-text-muted: #6e6e80;
  --color-text-dim: #a0a0b0;

  --color-bubble-assistant: #f0f0f3;

  --color-glass: rgba(0, 0, 0, 0.03);
  --color-glass-border: rgba(0, 0, 0, 0.06);
  --color-glass-hover: rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 2: Update hardcoded colors in plain CSS classes**

Replace hardcoded `white` and hex colors in the plain CSS section to use CSS variables:

- `.bubble--assistant`: `background: white` → `background: var(--color-bubble-assistant)`; `border: 1px solid var(--grey-200)` → `border: 1px solid var(--color-border)`
- `.bubble--user`: keep as-is (brand color, same in both themes)
- `.feedback-card`: `background: #fefce8` → `background: var(--color-surface-2)`; `border: 1px solid #fde68a` → `border: 1px solid var(--color-warning)`
- `.feedback-toggle`: `color: var(--grey-700)` → `color: var(--color-text)`
- `.input-bar`: `background: white` → `background: var(--color-surface)`; `border-top: 1px solid var(--grey-200)` → `border-top: 1px solid var(--color-border)`
- `.message-input`: `border: 1px solid var(--grey-300)` → `border: 1px solid var(--color-border)`
- `.message-input:focus`: `border-color: var(--blue)` → `border-color: var(--color-primary)`
- `.send-btn`: `background: var(--blue)` → `background: var(--color-primary)`
- `.send-btn:hover:not(:disabled)`: `background: var(--blue-dark)` → `background: var(--color-primary-dim)`
- `.error-banner`: `background: #fef2f2` → `background: var(--color-surface-2)`; `border: 1px solid #fecaca` → `border: 1px solid var(--color-danger)`; `color: var(--red)` → `color: var(--color-danger)`
- `.sessions-page__header`: `background: white` → `background: var(--color-surface)`; `border-bottom: 1px solid var(--grey-200)` → `border-bottom: 1px solid var(--color-border)`
- `.session-card`: `background: white` → `background: var(--color-surface)`; `border: 1px solid var(--grey-200)` → `border: 1px solid var(--color-border)`
- `.session-card:hover`: `border-color: var(--blue)` → `border-color: var(--color-primary)`
- `.session-card__mode`: `background: var(--grey-100)` → `background: var(--color-surface-2)`; `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.session-card__meta`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.session-detail__header`: `background: var(--grey-100)` → `background: var(--color-surface-2)`
- `.voice-btn`: `background: white` → `background: var(--color-surface)`; `border: 1px solid var(--grey-300)` → `border: 1px solid var(--color-border)`
- `.voice-btn:hover:not(:disabled)`: `background: var(--grey-100)` → `background: var(--color-surface-2)`
- `.voice-btn__spinner`: `border: 2px solid var(--grey-300)` → `border: 2px solid var(--color-border)`; `border-top-color: var(--blue)` → `border-top-color: var(--color-primary)`
- `.translation-tooltip`: `background: var(--grey-900, #1e1e1e)` → `background: var(--color-surface-3)`
- `.translation-tooltip::after`: `border-top-color: var(--grey-900, #1e1e1e)` → `border-top-color: var(--color-surface-3)`
- `.timestamp`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.typing-indicator span`: `background: var(--grey-300)` → `background: var(--color-border)`
- `.loading`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.feedback-section h4`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.correction-original`: `color: var(--red)` → `color: var(--color-danger)`
- `.correction-fixed`: `color: var(--green)` → `color: var(--color-success)`
- `.correction-explanation`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.vocab-example`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.sessions-link`: `color: var(--grey-500)` → `color: var(--color-text-muted)`
- `.sessions-link:hover`: `background: var(--grey-100)` → `background: var(--color-surface-2)`
- `.back-link`: `color: var(--blue)` → `color: var(--color-primary)`
- `.translatable-line`: `border-bottom: 1px dotted var(--grey-300, #ccc)` → `border-bottom: 1px dotted var(--color-border)`
- `.translatable-line:hover`: `border-bottom-color: var(--blue, #3b82f6)` → `border-bottom-color: var(--color-primary)`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat: add light theme CSS variables and replace hardcoded colors"
```

---

### Task 3: TopBar with ThemeToggle

**Files:**
- Create: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: Create TopBar component with theme toggle**

```tsx
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const options = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

export function TopBar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-surface/80 backdrop-blur-xl border-b border-border shrink-0">
      <span className="text-sm font-semibold gradient-text">Voxly</span>

      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
        {options.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              theme === value
                ? "bg-primary text-white"
                : "text-text-muted hover:text-text",
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "feat: add TopBar with theme toggle"
```

---

### Task 4: Wire ThemeProvider and TopBar into App

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add imports and wrap with ThemeProvider, add TopBar**

```tsx
import { ThemeProvider } from "@/context/ThemeContext";
import { TopBar } from "@/components/TopBar";
```

Wrap `BrowserRouter` contents with `ThemeProvider`, add `<TopBar />` above `<main>`:

```tsx
export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <div className="flex flex-col h-screen bg-background text-text">
          <TopBar />
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
      </ThemeProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: wire ThemeProvider and TopBar into App"
```

---

### Task 5: Verify and fix

- [ ] **Step 1: Open app in browser, toggle through all 3 modes**
- [ ] **Step 2: Check each page (Chat, Progress, Vocabulary, History) in light mode for any remaining hardcoded dark colors**
- [ ] **Step 3: Fix any issues found**
- [ ] **Step 4: Final commit**
