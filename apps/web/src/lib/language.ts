import type { Message, ReplyLine } from "./api";

/**
 * Language helpers for the Halo design, where color tells the learner which
 * language a piece of text is in: Spanish is amber, English is blue.
 */
export type Lang = "es" | "en";

export interface Segment {
  text: string;
  lang: Lang;
}

export interface CaptionLine {
  /** The sentence as said, split into language-colored segments. */
  segments: Segment[];
  /** The language of the sentence as a whole. */
  lang: Lang;
  /** English translation, only for Spanish sentences that have one. */
  translation?: string;
}

const SPANISH_MARKS = /[ñáéíóúü¿¡]/i;

// Short, very common words that tell the two languages apart. Words that both
// languages share (for example "a", "me", "no") are left out on purpose.
const ES_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "que",
  "y", "en", "es", "por", "para", "con", "se", "lo", "mi", "tu", "yo", "su",
  "qué", "cómo", "muy", "pero", "más", "hay", "está", "estoy", "soy", "eres",
  "bien", "gracias", "hola", "sí", "también", "porque", "cuando", "donde",
  "dónde", "fui", "fue", "tengo", "tiene", "quiero", "puedo", "hoy", "ahora",
  "bueno", "vale", "casi", "perfecto", "ese", "esa", "este", "esta", "esto",
  "como", "al", "le", "les", "nos", "te", "ser", "estar", "hacer",
]);

const EN_WORDS = new Set([
  "the", "and", "is", "are", "was", "were", "you", "i", "i'm", "it", "it's",
  "how", "what", "do", "does", "did", "say", "mean", "means", "in", "of",
  "to", "this", "that", "with", "for", "my", "your", "can", "could", "would",
  "should", "about", "because", "spanish", "english", "word", "like",
  "so", "but", "or", "if", "when", "where", "why", "which", "who", "we",
  "they", "she", "have", "just", "try", "again", "here", "there",
  "great", "good", "nice", "yes", "let's", "let", "said",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"“”'‘’.,!?¡¿:;()\-–—…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best guess at whether a short piece of text is Spanish or English. */
export function detectLang(text: string): Lang {
  const words = normalize(text).split(" ").filter(Boolean);
  let es = SPANISH_MARKS.test(text) ? 2 : 0;
  let en = 0;
  for (const w of words) {
    if (ES_WORDS.has(w)) es += 1;
    if (EN_WORDS.has(w)) en += 1;
  }
  if (en > es) return "en";
  return "es";
}

/** Split running text into sentences, keeping the end marks. */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]*["'»”’)]*\s*|[.!?…]+\s*/g);
  if (!parts) return text.trim() ? [text] : [];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Split one sentence into colored segments. Inside an English sentence, a
 * Spanish word or phrase that Sofía wraps in «guillemets» keeps the Spanish
 * color. The marks themselves are dropped from the display.
 */
export function segmentSentence(text: string, lang: Lang): Segment[] {
  if (lang === "es" || !text.includes("«")) {
    return [{ text: text.replace(/[«»]/g, ""), lang }];
  }
  const segments: Segment[] = [];
  const re = /«([^»]*)»/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), lang: "en" });
    }
    segments.push({ text: match[1], lang: "es" });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), lang: "en" });
  return segments;
}

/** The language of one reply line. English lines repeat themselves in "en". */
export function lineLang(line: ReplyLine): Lang {
  if (normalize(line.es) === normalize(line.en)) return "en";
  return detectLang(line.es);
}

/** Turn a message into caption lines, one per sentence, with language colors. */
export function captionLines(message: Pick<Message, "content" | "replyLines" | "role">): CaptionLine[] {
  if (message.role !== "user" && message.replyLines?.length) {
    return message.replyLines.map((line) => {
      const lang = lineLang(line);
      return {
        lang,
        segments: segmentSentence(line.es, lang),
        translation: lang === "es" && line.en ? line.en : undefined,
      };
    });
  }
  return splitSentences(message.content).map((sentence) => {
    const lang = detectLang(sentence);
    return { lang, segments: segmentSentence(sentence, lang) };
  });
}

/** The language that most of a message is in, weighted by length. */
export function dominantLang(lines: CaptionLine[]): Lang {
  let es = 0;
  let en = 0;
  for (const line of lines) {
    const size = line.segments.reduce((n, s) => n + s.text.length, 0);
    if (line.lang === "es") es += size;
    else en += size;
  }
  return en > es ? "en" : "es";
}

export function langName(lang: Lang): string {
  return lang === "es" ? "Spanish" : "English";
}
