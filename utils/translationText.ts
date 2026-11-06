// Translation text markup: footnote markers and other inline tags. A leaf
// module (no imports) so displays and their test mocks can share it.

// A footnote marker and its digit, quoted id or not.
const FOOTNOTE_MARKER = /<sup\s+foot_note=[^>]*>[\s\S]*?<\/sup>/g;
const ANY_TAG = /<[^>]*>/g;
// Bundled Saheeh quotes the id (foot_note="226402"); QF does not (foot_note=254011).
const FOOTNOTE_ID = /foot_note=(?:"([^"]+)"|(\d+))/;

export function stripFootnoteMarkers(text: string): string {
  return text.replace(FOOTNOTE_MARKER, '');
}

export function stripHtml(text: string): string {
  return text.replace(ANY_TAG, '');
}

/** The footnote id in a marker's opening tag; '' when it carries none. */
export function footnoteIdFromTag(tag: string): string {
  const match = FOOTNOTE_ID.exec(tag);
  return match ? (match[1] ?? match[2]) : '';
}
