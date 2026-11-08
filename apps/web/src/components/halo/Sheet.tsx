import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** A bottom sheet on phones and a centered panel on wider screens. */
export function Sheet({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-md max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-surface border border-border shadow-2xl animate-sheet-up focus:outline-none"
      >
        <div className="flex items-center justify-between gap-2 pl-5 pr-3 pt-3 pb-1 shrink-0">
          <h2 className="m-0 font-display text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
