import { Link } from "react-router-dom";
import { BarChart3, ChevronRight, Clock, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Sheet } from "./Sheet";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const MODES = [
  {
    value: "helper",
    label: "Helper",
    hint: "Sofía uses English when it helps.",
  },
  {
    value: "immersion",
    label: "Immersion",
    hint: "Spanish only, unless you ask in English.",
  },
];

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  level: string;
  onLevelChange: (level: string) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  handsFree: boolean;
  onHandsFreeToggle: () => void;
  muted: boolean;
  onMuteToggle: () => void;
  showEnglish: boolean;
  onShowEnglishToggle: () => void;
  showFeedback: boolean;
  onShowFeedbackToggle: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="m-0 mt-5 mb-2 text-[11px] font-semibold tracking-[0.12em] text-text-dim">
      {children}
    </h3>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="w-full min-h-14 flex items-center justify-between gap-4 py-2.5 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-text">{label}</span>
        <span className="text-[13px] text-text-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full transition-all",
            on ? "left-6 bg-on-primary" : "left-1 bg-text-muted",
          )}
        />
      </span>
    </button>
  );
}

const NAV_LINK =
  "flex items-center gap-3 min-h-12 px-1 rounded-xl text-[15px] font-medium text-text hover:bg-surface-2 transition-colors";

/** Session and app settings, opened from the talk screen. */
export function TalkSettings(props: Props) {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Settings">
      <SectionLabel>LEVEL</SectionLabel>
      <div
        role="group"
        aria-label="Level"
        className="grid grid-cols-6 gap-1 p-1 rounded-2xl bg-surface-2"
      >
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={props.level === l}
            onClick={() => props.onLevelChange(l)}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold transition-colors",
              props.level === l
                ? "bg-text text-background"
                : "text-text-muted hover:text-text",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <SectionLabel>ENGLISH HELP</SectionLabel>
      <div role="group" aria-label="English help" className="grid grid-cols-2 gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={props.mode === m.value}
            onClick={() => props.onModeChange(m.value)}
            className={cn(
              "flex flex-col gap-0.5 rounded-2xl border p-3 text-left transition-colors",
              props.mode === m.value
                ? "border-text bg-surface-2"
                : "border-border hover:border-border-bright",
            )}
          >
            <span className="text-[15px] font-semibold text-text">{m.label}</span>
            <span className="text-[13px] leading-snug text-text-muted">{m.hint}</span>
          </button>
        ))}
      </div>

      <SectionLabel>VOICE</SectionLabel>
      <div className="flex flex-col divide-y divide-border">
        <ToggleRow
          label="Hands-free"
          hint="The mic opens by itself after Sofía speaks."
          on={props.handsFree}
          onToggle={props.onHandsFreeToggle}
        />
        <ToggleRow
          label="Sofía’s voice"
          hint="Turn off to read her replies in silence."
          on={!props.muted}
          onToggle={props.onMuteToggle}
        />
      </div>

      <SectionLabel>ON SCREEN</SectionLabel>
      <div className="flex flex-col divide-y divide-border">
        <ToggleRow
          label="English under Spanish"
          hint="Show the translation in blue below each reply."
          on={props.showEnglish}
          onToggle={props.onShowEnglishToggle}
        />
        <ToggleRow
          label="Fixes and new words"
          hint="Show corrections and words saved to your Phrasebook."
          on={props.showFeedback}
          onToggle={props.onShowFeedbackToggle}
        />
      </div>

      <SectionLabel>THEME</SectionLabel>
      <div
        role="group"
        aria-label="Theme"
        className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-2"
      >
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={theme === t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              "h-11 rounded-xl text-sm font-semibold transition-colors",
              theme === t.value
                ? "bg-text text-background"
                : "text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 pt-3 border-t border-border flex flex-col">
        <Link to="/progress" className={NAV_LINK}>
          <BarChart3 className="w-5 h-5 text-text-muted" aria-hidden="true" />
          <span className="flex-1">Progress</span>
          <ChevronRight className="w-4 h-4 text-text-dim" aria-hidden="true" />
        </Link>
        <Link to="/history" className={NAV_LINK}>
          <Clock className="w-5 h-5 text-text-muted" aria-hidden="true" />
          <span className="flex-1">History</span>
          <ChevronRight className="w-4 h-4 text-text-dim" aria-hidden="true" />
        </Link>
        <button type="button" onClick={signOut} className={cn(NAV_LINK, "text-left")}>
          <LogOut className="w-5 h-5 text-text-muted" aria-hidden="true" />
          <span className="flex-1">Sign out</span>
        </button>
      </div>
    </Sheet>
  );
}
