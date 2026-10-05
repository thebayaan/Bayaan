import branding from '@/config/branding';
import {alQuranCloudTranslationProvider} from './AlQuranCloudTranslationProvider';

/**
 * RFC-009 — translation source resolver.
 *
 * `translationApiService` resolves to the fork-supplied
 * `branding.translationProvider` when set, otherwise to Bayaan's default
 * alQuran.cloud-backed `alQuranCloudTranslationProvider`. The exported
 * name and shape are unchanged, so consumers (`store/translationStore.ts`)
 * are untouched.
 */
export const translationApiService =
  branding.translationProvider ?? alQuranCloudTranslationProvider;

// `TranslationVerse` moved to `types/translation.ts` (RFC-009). Re-exported
// here so any importer of the previous location keeps compiling.
export type {TranslationVerse} from '@/types/translation';
