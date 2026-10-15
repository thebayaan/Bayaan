/**
 * RFC-018 — community-reflections provider contract.
 *
 * A `CommunityReflectionsProvider` resolves community-authored reflections
 * for one ayah. Bayaan ships no provider (`branding.communityReflectionsProvider`
 * is undefined) → the entire community-reflections surface is off. A fork
 * (e.g. Qariah, backed by QuranReflect) supplies one to light it up without
 * forking the hot verse-render path.
 *
 * The provider owns filtering/sorting (verified-only, popular-sorted, top-N,
 * language-filtered) and its own caching — the consuming component may call it
 * freely. It throws/rejects on network or auth/scope errors; the consumer
 * renders an empty/error state silently.
 *
 * See docs/rfcs/018-community-reflections-provider.md.
 */
export interface CommunityReflection {
  /** Stable id of the reflection on the source platform. */
  id: string;
  author: {
    name: string;
    handle: string;
    verified: boolean;
  };
  body: string;
  likesCount: number;
  commentsCount: number;
  /** ISO-8601 publish timestamp. */
  publishedAt: string;
  /** Canonical permalink to the reflection on the source platform. */
  url: string;
  /** BCP-47-ish language tag of the reflection body, e.g. 'en', 'ar'. */
  language: string;
}

/**
 * Fetches reflections for a single ayah.
 *
 * @param surahNumber 1-based surah number.
 * @param ayahNumber  1-based ayah number within the surah.
 * @param locale      User's translation preference (e.g. 'en', 'ar'); the
 *                    provider may combine `${locale},en` to surface English
 *                    fallbacks. Undefined → provider's own default.
 * @returns Possibly-empty array of reflections. Rejects on network/scope error.
 */
export type CommunityReflectionsProvider = (
  surahNumber: number,
  ayahNumber: number,
  locale?: string,
) => Promise<CommunityReflection[]>;
