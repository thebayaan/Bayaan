import {TRANSLATION_CROSSWALK} from '@/data/translationCrosswalk';

// The only bundled edition, and where every unusable selection lands.
export const DEFAULT_TRANSLATION_ID = 'clear-quran';
// The retired bundled Saheeh International.
export const RETIRED_SAHEEH_ID = 'saheeh';

const QF_TRANSLATION_ID = /^\d+$/;

// The QF id an AlQuranCloud id (or "saheeh") was matched to by text, or null.
export function crosswalkTranslationId(id: string): string | null {
  if (!Object.hasOwn(TRANSLATION_CROSSWALK, id)) return null;
  return String(TRANSLATION_CROSSWALK[id]);
}

/**
 * Maps a translation selection from before the switch to QF translations.
 *
 * When Bayaan's content engine manages translations, ids are bare QF ids
 * ("20") or the bundled "clear-quran": a crosswalked AlQuranCloud id (or
 * "saheeh") becomes its QF id, and any other non-numeric id becomes
 * "clear-quran". A fork with its own translation provider (RFC-009) keeps its
 * ids; only the retired bundled "saheeh" moves to "clear-quran".
 */
export function remapLegacyTranslationId(
  id: string,
  managedByEngine: boolean,
): string {
  if (id === DEFAULT_TRANSLATION_ID) return id;
  if (!managedByEngine)
    return id === RETIRED_SAHEEH_ID ? DEFAULT_TRANSLATION_ID : id;
  if (QF_TRANSLATION_ID.test(id)) return id;
  return crosswalkTranslationId(id) ?? DEFAULT_TRANSLATION_ID;
}
