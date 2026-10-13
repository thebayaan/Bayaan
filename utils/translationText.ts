// Translation text markup. QF text carries inline HTML: footnote markers
// (<sup foot_note=N>n</sup>, sometimes wrapped in <a class=f>), <i>, <span>
// and entities such as &quot;. A leaf module (no imports) so displays and
// their test mocks can share it.

// A footnote marker and its digit, quoted id or not.
const FOOTNOTE_MARKER = /<sup\s+foot_note=[^>]*>[\s\S]*?<\/sup>/g;
const ANY_TAG = /<[^>]*>/g;
// Every tag FormattedText does not render: kept are b, i, u and sup.
const UNRENDERED_TAG = /<(?!\/?(?:b|i|u|sup)(?:\s[^>]*)?\/?>)[^>]*>/g;
// <i class="x"> renders as <i>: FormattedText matches bare tags only.
const STYLE_TAG_WITH_ATTRIBUTES = /<(b|i|u)\s[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

export function stripFootnoteMarkers(text: string): string {
  return text.replace(FOOTNOTE_MARKER, '');
}

export function stripHtml(text: string): string {
  return text.replace(ANY_TAG, '');
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi,
    (entity: string, name: string) => {
      const lower = name.toLowerCase();
      if (lower.startsWith('#x'))
        return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith('#'))
        return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return NAMED_ENTITIES[lower] ?? entity;
    },
  );
}

/**
 * Translation text for every plain-text use (copy, share, widgets, previews,
 * sheets without footnote support): footnote markers go with their digits,
 * then every other tag; entities are decoded and doubled spaces collapsed.
 */
export function translationPlainText(text: string): string {
  return decodeHtmlEntities(stripHtml(stripFootnoteMarkers(text)))
    .replace(/[ \t\u00a0]{2,}/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Markup for FormattedText: only the tags it renders (b, i, u, sup), without
 * attributes on b/i/u. Footnote markers keep their ids.
 */
export function formattedTranslationMarkup(text: string): string {
  return text
    .replace(UNRENDERED_TAG, '')
    .replace(STYLE_TAG_WITH_ATTRIBUTES, '<$1>');
}
