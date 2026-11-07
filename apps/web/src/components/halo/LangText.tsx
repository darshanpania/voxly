import { cn } from "@/lib/utils";
import { segmentSentence, type CaptionLine, type Lang } from "@/lib/language";

export const LANG_TEXT_CLASS: Record<Lang, string> = {
  es: "text-es",
  en: "text-en",
};

interface Props {
  lines: CaptionLine[];
  className?: string;
}

/**
 * Text in the language colors: Spanish amber, English blue, down to a single
 * Spanish word inside an English sentence.
 */
export function LangText({ lines, className }: Props) {
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && " "}
          {line.segments.map((seg, j) => (
            <span
              key={j}
              lang={seg.lang}
              className={cn(
                LANG_TEXT_CLASS[seg.lang],
                // Spanish inside an English sentence stands out a little more.
                line.lang === "en" && seg.lang === "es" && "font-semibold",
              )}
            >
              {seg.text}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

/**
 * An English note, such as a fix explanation. Spanish words that Sofía marks
 * with «guillemets» keep the Spanish color.
 */
export function EnglishNote({ text, className }: { text: string; className?: string }) {
  return (
    <LangText lines={[{ segments: segmentSentence(text, "en"), lang: "en" }]} className={className} />
  );
}

/** The English translation of the Spanish lines, or null if there is none. */
export function translationOf(lines: CaptionLine[]): string | null {
  const parts = lines
    .filter((l) => l.lang === "es" && l.translation)
    .map((l) => l.translation as string);
  return parts.length ? parts.join(" ") : null;
}
