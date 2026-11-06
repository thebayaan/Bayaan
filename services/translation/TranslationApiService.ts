import branding from '@/config/branding';
import type {TranslationProvider} from '@/types/TranslationProvider';

/**
 * RFC-009: the fork seam for translations.
 *
 * Bayaan installs translations through content sync (Quran Foundation, see
 * services/content/translationInstaller.ts). A fork that sets
 * `branding.translationProvider` keeps its own source: the picker lists the
 * provider's editions and downloads them through it. Null when no fork
 * provider is set. Read at call time, so importing this module never
 * touches branding.
 */
export function getForkTranslationProvider(): TranslationProvider | null {
  return branding.translationProvider ?? null;
}

// `TranslationVerse` moved to `types/translation.ts` (RFC-009). Re-exported
// here so any importer of the previous location keeps compiling.
export type {TranslationVerse} from '@/types/translation';
