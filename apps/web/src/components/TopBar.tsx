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
