import type {
  RemoteTranslationEdition,
  TranslationVerse,
} from '@/types/translation';

/**
 * RFC-009 — pluggable translation source.
 *
 * A `TranslationProvider` supplies the editions list and full-translation
 * download used by Settings → Translations when a fork sets
 * `branding.translationProvider`. Without one, Bayaan installs Quran
 * Foundation translations through content sync.
 *
 * The SQLite cache layer (`translationDbService`) sits outside this
 * contract — providers return in-memory `{edition, verses}` only.
 */
export interface TranslationProvider {
  /** Lists every translation edition the provider can serve. */
  fetchAvailableEditions(): Promise<RemoteTranslationEdition[]>;

  /**
   * Fetches every verse for one edition. The progress callback fires at
   * surah granularity (0..1). The returned `edition` MUST have
   * `direction` set — the provider is responsible for defaulting it
   * when the upstream API omits it.
   */
  fetchFullTranslation(
    editionId: string,
    onProgress?: (progress: number) => void,
  ): Promise<{
    edition: RemoteTranslationEdition;
    verses: TranslationVerse[];
  }>;
}
