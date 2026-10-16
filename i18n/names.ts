// @ai-generated
import {isAppLanguage} from './languages';

const MAX_NAME_LENGTH = 120;

// Control characters, bidi embeddings/overrides/isolates, directional marks,
// zero-width characters and line/paragraph separators. None belongs in a
// display name, and the bidi ones can make a label read differently.
const UNSAFE_CHARACTERS =
  /[\p{Cc}\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/u;

/**
 * Keeps only well-formed display names from the API: string values for
 * languages the app knows, NFC-normalised, non-empty, short and free of
 * control or bidi characters. Anything else is dropped so a bad record
 * cannot crash a <Text> or spoof a label.
 */
export function sanitizeDisplayNames(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const names: Record<string, string> = {};
  for (const [language, name] of Object.entries(value)) {
    if (!isAppLanguage(language) || typeof name !== 'string') {
      continue;
    }
    const normalized = name.normalize('NFC').trim();
    if (
      normalized &&
      normalized.length <= MAX_NAME_LENGTH &&
      !UNSAFE_CHARACTERS.test(normalized)
    ) {
      names[language] = normalized;
    }
  }
  return Object.keys(names).length > 0 ? names : undefined;
}
