import {TRANSLATION_CROSSWALK} from '@/data/translationCrosswalk';
import {isEngineManagingTranslations} from '@/services/content/contentScope';

// The only bundled edition, and where every unusable selection lands.
export const DEFAULT_TRANSLATION_ID = 'clear-quran';
// The retired bundled Saheeh International.
export const RETIRED_SAHEEH_ID = 'saheeh';

const QF_TRANSLATION_ID = /^\d+$/;

// Quran Foundation translation ids are bare numbers ("20").
export function isQfTranslationId(id: string): boolean {
  return QF_TRANSLATION_ID.test(id);
}

// The QF id an AlQuranCloud id (or "saheeh") was matched to by text, or null.
export function crosswalkTranslationId(id: string): string | null {
  if (!Object.hasOwn(TRANSLATION_CROSSWALK, id)) return null;
  return String(TRANSLATION_CROSSWALK[id]);
}

/**
 * A selection from before the switch, for builds where Bayaan's content
 * engine manages translations: ids are bare QF ids or the bundled
 * "clear-quran". A crosswalked AlQuranCloud id (or "saheeh") becomes its QF
 * id; any other non-numeric id becomes "clear-quran".
 */
export function qfTranslationSelection(id: string): string {
  if (id === DEFAULT_TRANSLATION_ID || isQfTranslationId(id)) return id;
  return crosswalkTranslationId(id) ?? DEFAULT_TRANSLATION_ID;
}

/**
 * A selection from before the switch, for a fork with its own translation
 * provider (RFC-009): its ids are kept; only the retired bundled "saheeh"
 * moves to "clear-quran".
 */
export function providerTranslationSelection(id: string): string {
  return id === RETIRED_SAHEEH_ID ? DEFAULT_TRANSLATION_ID : id;
}

// The selection this build uses for one saved or synced before the switch.
export function currentTranslationSelection(id: string): string {
  return isEngineManagingTranslations()
    ? qfTranslationSelection(id)
    : providerTranslationSelection(id);
}
