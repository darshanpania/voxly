// Surrounding punctuation stripped from word edges. Diacritics are NOT
// included here — accents are meaningful in Spanish and must be preserved.
const SURROUNDING_PUNCTUATION = /^[.,;:!?¿¡"'()]+|[.,;:!?¿¡"'()]+$/g;

// Spanish articles removed when they lead a multi-word phrase (word-boundary,
// followed by more text). Order/casing handled via the lowercased comparison.
const SPANISH_LEADING_ARTICLES = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
]);

/**
 * Normalize a vocabulary word so lookups collapse to a single canonical card.
 * Trims, collapses internal whitespace, strips surrounding punctuation,
 * lowercases (locale-aware for Spanish), and for Spanish drops a single
 * leading article. Accents/diacritics are preserved. Falls back to the
 * trimmed original if normalization would yield an empty string.
 *
 * Illustrative cases:
 *   normalizeWord("Comer", "es")      -> "comer"
 *   normalizeWord("El Comer.", "es")  -> "comer"
 *   normalizeWord("el pan", "es")     -> "pan"
 *   normalizeWord("¿Cómo?", "es")     -> "cómo"        (accent kept)
 *   normalizeWord("  la   casa ", "es") -> "casa"
 *   normalizeWord("Running", "en")    -> "running"     (no article stripping)
 *   normalizeWord("el", "es")         -> "el"          (article-only, kept)
 */
export function normalizeWord(word: string, language: string): string {
  const trimmed = word.trim();
  if (!trimmed) return word.trim();

  // Collapse internal whitespace runs to single spaces.
  let result = trimmed.replace(/\s+/g, " ");

  // Strip punctuation from both ends.
  result = result.replace(SURROUNDING_PUNCTUATION, "");

  // Lowercase, locale-aware for Spanish.
  result =
    language === "es" ? result.toLocaleLowerCase("es") : result.toLowerCase();

  // For Spanish, strip a single leading article only when more text follows.
  if (language === "es") {
    const spaceIndex = result.indexOf(" ");
    if (spaceIndex > 0) {
      const leading = result.slice(0, spaceIndex);
      if (SPANISH_LEADING_ARTICLES.has(leading)) {
        result = result.slice(spaceIndex + 1).trim();
      }
    }
  }

  return result.length > 0 ? result : trimmed;
}
