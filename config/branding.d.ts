import type {ComponentType} from 'react';
import type {Track} from '@/types/audio';
import type {TranslationProvider} from '@/types/TranslationProvider';
import type {TafsirProvider} from '@/types/TafsirProvider';
import type {CommunityReflectionsProvider} from '@/types/CommunityReflection';
import type {AyahTimestamp} from '@/types/timestamps';

/** Catalog source config for the active branding. */
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  /** Path to bundled JSON catalog file; undefined = use data/reciters-fallback.json. */
  fallbackPath?: string;
}

/**
 * Identifier for a Listen-tab home row.
 *
 * Each id corresponds to a section rendered by `components/RecitersView.tsx`.
 * Forks select which rows to show and in what order by listing ids in
 * `Branding.homeRowConfig`. Unknown ids are ignored (forward-compat for forks
 * that haven't been updated when a new row is added upstream).
 */
export type HomeRowId =
  | 'continue-listening'
  | 'new-to-quran'
  | 'favorites'
  | 'featured'
  | 'adhkar'
  | 'follow-along'
  | 'playlists'
  | 'exclusives'
  | 'tajweed'
  | 'memorization'
  | 'rewayat'
  | 'collection';

/** Per-row toggle for the Listen-tab home rows. */
export interface HomeRow {
  id: HomeRowId;
  /** Whether this row renders. Rows whose data is empty still self-hide. */
  enabled: boolean;
}

/**
 * Props passed to a fork's `listenTabTopComponent` (RFC-008).
 *
 * Reserved for future extension — the slot starts with no required props
 * so forks can ship a plain `() => JSX.Element`. Any future additions
 * (theming context, navigation hooks, …) must default to optional so
 * existing implementations keep compiling.
 */
export interface ListenTabTopComponentProps {}

/**
 * RFC-012 / RFC-020 — identifier for a Search/Browse-tab filter dimension.
 *
 * Each id is a predicate the `BrowseReciters` filter pipeline can apply
 * to the reciter list. Forks declare an array in `branding.searchFilters`
 * to opt in to the user-editable chip framework; when undefined, the
 * Search tab keeps today's bespoke chip set (teacher/student) unchanged.
 *
 * `rewaya` / `has-surah` / `has-photo` / `recitation-style` resolve
 * against fields that already exist on `Reciter` / `Reciter.rewayat[]`.
 * `country` / `translation` need the corresponding `Reciter` field
 * populated from the catalog first — a fork declaring one before the
 * field is populated gets an empty, harmless chip. `full-quran` has no
 * dedicated field — it's derived: any of the reciter's `rewayat[]` with
 * `surah_total === 114`.
 *
 * See `SearchFilterFlagFacet` for the generic boolean-field form used by
 * fork-only facets (e.g. a curated collection flag) that shouldn't
 * widen this shared string union.
 */
export type SearchFilterDimension =
  | 'rewaya' // Reciter.rewayat[].name — teacher/student (already bespoke; here for future migration)
  | 'has-surah' // surah picker → Reciter.rewayat[].surah_list includes (already bespoke; here for future migration)
  | 'has-photo' // Reciter.image_url present
  | 'recitation-style' // Reciter.rewayat[].style — canonical slugs 'murattal'|'mojawwad'|'moalim' per data/rewayat-slugs.json (already bespoke; here for future migration)
  | 'country' // Reciter.country present — requires the field populated from the catalog
  | 'translation' // Reciter.translation present — requires the field populated from the catalog
  | 'full-quran'; // any Reciter.rewayat[] with surah_total === 114 — derived, no dedicated field

/**
 * RFC-020 — generic boolean-facet form for tenant-specific filter chips
 * that don't belong in the shared `SearchFilterDimension` string union
 * (e.g. a fork's curated collection flags such as an editorial
 * "featured" set). `field` names a boolean-or-undefined property on
 * `Reciter`; a reciter matches the facet when that property is `true`.
 * `label` is the chip's display text.
 *
 * Deliberately generic (a `string field`, not a literal union of known
 * fork fields) so a tenant can add its own boolean `Reciter` field and
 * surface it as a chip without widening this shared type.
 *
 * @example
 * { kind: 'flag', field: 'featured', label: 'Featured' }
 */
export interface SearchFilterFlagFacet {
  kind: 'flag';
  /** A boolean (or undefined) field on `Reciter` this facet filters by. */
  field: string;
  /** Chip display label. */
  label: string;
}

/** App identity values that vary across forks. */
export interface Branding {
  appName: string;
  appSlug: string;
  urlScheme: string;
  bundleId: {ios: string; android: string};
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
  shareBaseUrl: string;
  emailProductName: string;
  catalog: BrandingCatalogConfig;
  /**
   * Order + visibility of Listen-tab home rows.
   *
   * Optional — when undefined, RecitersView falls back to the built-in
   * default order (preserving today's Bayaan behavior verbatim). Forks
   * override by declaring their own array. Order in the array == render
   * order. Empty-data rows self-hide regardless of `enabled`.
   *
   * @example
   * homeRowConfig: [
   *   { id: 'continue-listening', enabled: true },
   *   { id: 'favorites', enabled: true },
   *   { id: 'featured', enabled: true },
   * ]
   */
  homeRowConfig?: HomeRow[];
  /**
   * RFC-010 — optional URL the app polls on cold-start (and on
   * `AppState 'active'`, debounced) to discover catalog updates. The
   * response is expected to be JSON of shape:
   *
   *   { version: number, updated_at?: string, url?: string }
   *
   * If `version` exceeds the locally-tracked last-seen version, the app
   * refetches the catalog. When `url` is present, it points at an
   * immutable per-version snapshot — preferred over the live catalog URL
   * because the URL itself is the CDN cache key.
   *
   * Undefined (default) → no polling. Bayaan ships undefined; forks with
   * dynamic catalog operations (e.g. Qariah's ops console) set it.
   *
   * Fail-open: any poll failure is swallowed. The bundled catalog is
   * always the source of truth on cold-start.
   */
  catalogVersionEndpoint?: string;
  /**
   * RFC-008 — optional component that replaces the Listen-tab top
   * region (the default `RecitersHero`). Forks return a React
   * component; `undefined` keeps Bayaan's `RecitersHero` verbatim.
   *
   * The component renders directly inside the Listen-tab ScrollView at
   * the top, above the rows controlled by `homeRowConfig`. It receives
   * no required props today; `ListenTabTopComponentProps` is a slot for
   * future extension.
   */
  listenTabTopComponent?: ComponentType<ListenTabTopComponentProps>;
  /**
   * RFC-012 / RFC-020 — composable Search-tab filter dimensions. When
   * set, the Search tab renders a user-editable chip per entry; tiles on
   * the Home tab can deeplink in with chips pre-applied via the matching
   * URL params on the `reciter/browse` route. Chips render in
   * declaration order, AFTER Bayaan's existing bespoke chips
   * (teacher/student) — trailing position is intentional so users of a
   * forked build see the familiar chips first and the fork's additions
   * after.
   *
   * Tri-state semantics:
   *   - `undefined` (default) — "not migrated"; Search tab keeps
   *     today's bespoke chip set unchanged. Bayaan ships this.
   *   - `[]` — "explicitly disable all chips". Observably the same as
   *     `undefined` today, but the intent is distinct for future v2
   *     migration when bespoke chips themselves move under this seam.
   *   - non-empty array — opt in to the listed dimensions/facets.
   *
   * Each entry is either a `SearchFilterDimension` string (a predicate
   * built into the shared filter pipeline) or a `SearchFilterFlagFacet`
   * object (a tenant-supplied boolean `Reciter` field, e.g. a curated
   * collection flag) — see both types above.
   *
   * @example
   * searchFilters: ['rewaya', 'has-photo', {kind: 'flag', field: 'featured', label: 'Featured'}]
   */
  searchFilters?: Array<SearchFilterDimension | SearchFilterFlagFacet>;
  /**
   * RFC-013 — optional hook returning the verse_key (e.g. `"2:197"`) the
   * PlayerSheet ayah list (`QuranView`) should anchor on for the
   * currently-playing track. Called on cold-mount and on every
   * currentSurah change thereafter. Returning `undefined` (the default)
   * keeps the current scroll-to-top-of-surah behavior verbatim.
   *
   * Used by forks that ship range-restricted recitations (audio tracks
   * covering only a subset of a surah). The hook returns the start of
   * that subset; QuranView handles the rest (initial-scroll position +
   * deferred imperative scroll on subsequent surah changes).
   *
   * If the returned verse_key isn't found in the current surah's verses,
   * QuranView silently falls back to scrolling to the top.
   *
   * @example
   * // Fork with catalog metadata describing partial recitations:
   * initialPlayerVerseKey: (track) => {
   *   if (!track.surahId || !track.reciterId) return undefined;
   *   const surahNum = parseInt(track.surahId, 10);
   *   if (Number.isNaN(surahNum)) return undefined;
   *   const meta = getSurahMetadata(track.reciterId, track.rewayatId, surahNum);
   *   if (!meta || meta.is_full || !meta.range) return undefined;
   *   return `${track.surahId}:${meta.range.from}`;
   * }
   */
  initialPlayerVerseKey?: (track: Track) => string | undefined;
  /**
   * RFC-009 — optional translation source for Settings → Translations.
   * `undefined` keeps Bayaan's default (the alQuran.cloud-backed
   * `alQuranCloudTranslationProvider`).
   */
  translationProvider?: TranslationProvider;
  /**
   * RFC-009 — optional tafsir source for Settings → Tafsir. `undefined`
   * keeps Bayaan's default (the api.quran.com-backed
   * `quranComTafsirProvider`).
   */
  tafsirProvider?: TafsirProvider;
  /**
   * RFC-018 — optional fetcher for community-authored reflections on an
   * ayah. Paired with `ayahCommunityReflectionsComponent` below.
   *
   * `undefined` (Bayaan default) → the entire community-reflections
   * surface is off: the Mushaf-settings toggle row never renders, the
   * inline slot returns nothing, and the action-sheet row is hidden.
   * A fork supplies a provider (e.g. Qariah's QuranReflect-backed
   * fetcher) to light it up without forking the verse-render path.
   *
   * Resolves to a possibly-empty array of reflections for the
   * (surahNumber, ayahNumber). The provider owns filtering/sorting and
   * caching — the consuming component calls it freely. Throws/rejects on
   * network or auth/scope errors; the consumer renders an empty/error
   * state silently.
   *
   * See docs/rfcs/018-community-reflections-provider.md.
   */
  communityReflectionsProvider?: CommunityReflectionsProvider;
  /**
   * RFC-018 — optional render slot (RFC-008 component-slot pattern)
   * mounted under the Arabic line in the verse list when the user's
   * `MushafSettingsStore.showCommunityReflections` toggle is on.
   *
   * `undefined` (Bayaan default) → nothing renders even if
   * `communityReflectionsProvider` is set (a fork can supply data
   * without inline UI, e.g. to power only the action-sheet popup). The
   * upstream default-noop `<AyahCommunityReflections />` wrapper checks
   * this field and returns null when unset, so mounting it in `VerseItem`
   * is free for Bayaan.
   *
   * The component is responsible for calling
   * `communityReflectionsProvider` itself (provider-internal caching is
   * what keeps that from being a second fetch). It runs per-ayah on a
   * recycling FlashList, so it must be non-blocking and tolerate rapid
   * mount/unmount/key churn; the upstream wrapper additionally guards it
   * with an error boundary at the mount site.
   *
   * Props start at `{surahNumber, ayahNumber}` only; future additions
   * (theme context, an open-popup callback) must default to optional so
   * existing implementations keep compiling.
   *
   * See docs/rfcs/018-community-reflections-provider.md.
   */
  ayahCommunityReflectionsComponent?: ComponentType<{
    surahNumber: number;
    ayahNumber: number;
  }>;
  /**
   * RFC-014 — strategy for wiring the player Mushaf FlashList's scroll
   * handling.
   *
   * `'gorhom'` — `useBottomSheetScrollableCreator()` is called and its
   *   result is passed as `renderScrollComponent` on FlashList. The
   *   swipe-down-to-dismiss gesture on the player sheet is active.
   *   Imperative `scrollToIndex` / `scrollToOffset` calls issued before
   *   the sheet's animation has settled into EXTENDED/FILL_PARENT are
   *   intercepted by the gorhom wrapper and silently no-op.
   *
   * `'native'` — gorhom wrapper skipped; imperative scroll calls reach
   *   the native scroll node immediately, regardless of the sheet's
   *   animation state. The sheet's swipe-down-to-dismiss gesture stops
   *   working at the Mushaf list level — forks opting in must provide
   *   an alternative dismiss affordance (e.g. an explicit close button
   *   in the player header). A `__DEV__`-only warning fires once per
   *   JS context to surface this responsibility.
   *
   * Field absent from `config/branding.js` → consumer applies
   * `?? 'gorhom'` at the call site, byte-equivalent to today's behavior.
   *
   * Applies identically on iOS and Android — forks don't need
   * platform-conditional branding. A future strategy (e.g.
   * `'gesture-handler-v3'`) is an additive change to this union.
   *
   * See docs/rfcs/014-player-scroll-strategy-seam.md.
   */
  playerMushafScrollBehavior?: 'gorhom' | 'native';
  /**
   * RFC-015 — base URL for ayah-timestamp JSONs served from a fork's
   * R2 bucket (or any CDN with the same
   * `{base}/{rewayatId}/{NNN}.json` layout `TimestampFetchService`
   * constructs).
   *
   * Field absent → consumer applies `?? 'https://cdn.thebayaan.com/timestamps'`
   * at the call site → byte-equivalent to today's behavior.
   *
   * Forks set this to their own mirror's base when the `has_timestamps`
   * flag is true for any reciter in their catalog and the timestamp
   * JSONs live somewhere other than the Bayaan production CDN. No
   * trailing slash; consumer composes
   * `${timestampCdnBase}/${rewayatId}/${paddedSurah}.json`.
   *
   * See docs/rfcs/015-timestamp-cdn-seam.md.
   */
  timestampCdnBase?: string;
  /**
   * RFC-019 — optional provider for **bundled** ayah-timing data, for forks
   * that ship their own offline-authored timestamps for a reciter rather than
   * serving them from a CDN (see `timestampCdnBase`, RFC-015).
   *
   * Called by `TimestampFetchService.fetchAndCache` (the data path) before any
   * network fetch, and only for a `(rewayatId, surahNumber)` the companion
   * `timestampLocalSurahList` claims. Return the surah's timestamps (validated
   * with the same first-element shape guard the R2 path uses, then written to
   * the cache with source `'local'`), or `null` to fall through to the
   * existing R2/CDN path.
   *
   * Field absent → consumer applies `?? null` at the call site →
   * byte-equivalent to today's behavior (network-only resolution). Bayaan
   * ships this unset.
   *
   * Must be synchronous and side-effect-free. Read bundled data from a
   * module-level import, not I/O.
   *
   * See docs/rfcs/019-timestamp-local-provider.md.
   */
  timestampLocalProvider?: (
    rewayatId: string,
    surahNumber: number,
  ) => AyahTimestamp[] | null;
  /**
   * RFC-019 — optional **coverage signal** companion to
   * `timestampLocalProvider`: the list of surah numbers the bundle covers for
   * a rewayat, or `null` / `[]` for a rewayat with no local coverage.
   *
   * This is what `hasSource` / `hasSurah` consult to gate the follow-along UI —
   * NOT a presence probe against the data provider. Coverage is an **exact
   * allow-list**: a surah counts as locally covered only when this list
   * includes it. Unlike the R2 path, an empty list does NOT mean "all surahs";
   * it means "no local coverage". Keying coverage by rewayat (rather than
   * probing a fixed sentinel surah) is required for **partial-coverage**
   * reciters whose `surah_list` lacks surah 1 — a surah-1 probe would falsely
   * suppress the feature for them.
   *
   * Mirrors the catalog's existing `Rewayat.timestamps_surah_list?: number[]`
   * one-to-one, so the local path answers coverage the same way the R2 path
   * already does. A fork sets this alongside `timestampLocalProvider`; the two
   * must agree (every surah in the list must have data from the provider).
   *
   * Field absent → consumer applies `?? null` at the call site →
   * byte-equivalent to today's behavior. Bayaan ships this unset.
   *
   * Must be synchronous and side-effect-free.
   *
   * See docs/rfcs/019-timestamp-local-provider.md.
   */
  timestampLocalSurahList?: (rewayatId: string) => number[] | null;
}

declare const branding: Branding;
export default branding;
