// @ai-generated
/**
 * A translation as plain text.
 *
 * The bundled translations mark their footnotes inline:
 *   …the Ever-Living,<sup foot_note="226497">1</sup> the Self-Sustaining.
 * Removing only the tags leaves the footnote number stuck to the word before
 * it ("the Ever-Living,1 the Self-Sustaining"), and not removing them pastes
 * the markup itself. So a footnote marker goes together with its number, and
 * then any other tag.
 *
 * Use it wherever a translation is copied, shared, or shown without footnote
 * links. The verse rows that draw Saheeh's footnotes as tappable markers
 * (components/utils/FormattedText) need the markup and keep the raw text.
 */
export function stripTranslationMarkup(text: string): string {
  return text.replace(/<sup[^>]*>[^<]*<\/sup>/g, '').replace(/<[^>]+>/g, '');
}
