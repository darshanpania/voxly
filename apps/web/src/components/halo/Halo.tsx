import { useEffect, useRef, type RefObject } from "react";
import type { Lang } from "@/lib/language";

export type HaloMode = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  mode: HaloMode;
  /** Color of the halo: the language being spoken, or neutral while listening. */
  tone: Lang | "neutral";
  /** Live mic level (0 to 1) that drives the bars while listening. */
  levelRef?: RefObject<number>;
  className?: string;
}

// Relative bar heights, so the meter looks like a voice and not a block.
const BAR_SHAPE = [0.45, 0.8, 1, 0.7, 0.9, 0.5];

/**
 * The live voice visual on the talk screen. Rings and a core in the color of
 * the language: amber while Sofía speaks Spanish, blue while she speaks
 * English, and the text color while it listens to you.
 */
export function Halo({ mode, tone, levelRef, className }: Props) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const ringRef = useRef<HTMLSpanElement | null>(null);

  // While listening, follow the real mic level. A ref and direct style writes
  // keep this at 60 fps without re-rendering the page.
  useEffect(() => {
    if (mode !== "listening" || !levelRef) return;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let frame = 0;
    let smooth = 0;
    const tick = () => {
      const target = levelRef.current ?? 0;
      smooth += (target - smooth) * 0.3;
      barsRef.current.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${0.25 + smooth * 0.75 * BAR_SHAPE[i]})`;
      });
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + smooth * 0.06})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const bars = barsRef.current;
    const ring = ringRef.current;
    return () => {
      cancelAnimationFrame(frame);
      bars.forEach((bar) => bar?.style.removeProperty("transform"));
      ring?.style.removeProperty("transform");
    };
  }, [mode, levelRef]);

  return (
    <div
      className={className ? `halo ${className}` : "halo"}
      data-mode={mode}
      data-tone={tone}
      aria-hidden="true"
    >
      <span className="halo__ring halo__ring--outer" />
      <span className="halo__ring halo__ring--mid" />
      <span ref={ringRef} className="halo__ring halo__ring--inner" />
      <span className="halo__core">
        {BAR_SHAPE.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="halo__bar"
          />
        ))}
      </span>
    </div>
  );
}
