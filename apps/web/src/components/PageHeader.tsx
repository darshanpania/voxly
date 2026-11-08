import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Where the back button goes. The talk screen by default. */
  backTo?: string;
  backLabel?: string;
  /** Use a button instead of a link, for a view inside the same page. */
  onBack?: () => void;
  right?: ReactNode;
}

const BACK_CLASS =
  "h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors";

/** Header for the pages you open from the talk screen. */
export function PageHeader({
  title,
  subtitle,
  backTo = "/",
  backLabel = "Back to talk",
  onBack,
  right,
}: Props) {
  return (
    <header className="shrink-0 w-full max-w-2xl mx-auto flex items-start gap-1 pl-2 pr-4 pt-2 pb-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
          className={BACK_CLASS}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      ) : (
        <Link to={backTo} aria-label={backLabel} title={backLabel} className={BACK_CLASS}>
          <ChevronLeft className="w-6 h-6" />
        </Link>
      )}
      <div className="flex-1 min-w-0 pt-1">
        <h1 className="m-0 font-display text-[26px] leading-tight font-bold">{title}</h1>
        {subtitle && <p className="m-0 mt-0.5 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 pt-0.5">{right}</div>}
    </header>
  );
}
