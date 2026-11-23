// @ai-generated
/**
 * Translation text for copying and sharing verses.
 *
 * Plain: without the footnote markers the stored text carries
 * (utils/translationMarkup).
 *
 * And complete for a downloaded translation: the quick lookup
 * (getTranslationTextRaw) reads a copy held in memory, which exists only
 * once the selected translation has been applied to the verse data. Until
 * then (the read is still running just after launch, or it failed) the
 * lookup returns nothing, and the copied or shared text silently had no
 * translation. A miss is therefore read from the translations database.
 */
import {BUNDLED_TRANSLATIONS} from '@/types/translation';
import {translationDbService} from '@/services/translation/TranslationDbService';
import {getTranslationTextRaw} from '@/utils/translationLookup';
import {stripTranslationMarkup} from '@/utils/translationMarkup';

/**
 * Loads the plain translation of each Hafs verse in `translationId` and
 * returns the lookup ('' for a verse it has no text for). Never rejects.
 */
export async function loadPlainTranslations(
  hafsKeys: readonly string[],
  translationId: string,
): Promise<(hafsKey: string) => string> {
  const isDownloaded = !(translationId in BUNDLED_TRANSLATIONS);
  const texts = new Map<string, string>();
  await Promise.all(
    [...new Set(hafsKeys)].map(async hafsKey => {
      let text = getTranslationTextRaw(hafsKey, translationId);
      if (!text && isDownloaded) {
        try {
          text =
            (await translationDbService.getTranslation(
              hafsKey,
              translationId,
            )) ?? '';
        } catch {
          // Database not open or unreadable: share without a translation.
          text = '';
        }
      }
      texts.set(hafsKey, stripTranslationMarkup(text));
    }),
  );
  return hafsKey => texts.get(hafsKey) ?? '';
}
