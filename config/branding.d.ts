import type {ComponentType} from 'react';
import type {Track} from '@/types/audio';
import type {TranslationProvider} from '@/types/TranslationProvider';
import type {TafsirProvider} from '@/types/TafsirProvider';

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
 * RFC-012 — identifier for a Search/Browse-tab filter dimension.
 *
 * Each id is a predicate the `BrowseReciters` filter pipeline can apply
 * to the reciter list. Forks declare an array in `branding.searchFilters`
 * to opt in to the user-editable chip framework; when undefined, the
 * Search tab keeps today's bespoke chip set (teacher/student) unchanged.
 *
 * v1 ships the exists-today subset only — every dimension here resolves
 * against fields that already exist on `Reciter` / `Reciter.rewayat[]`.
 * Future dimensions (`country`, `translation`) require the corresponding
 * fields to be added to the `Reciter` type and populated from the
 * catalog first; they're not part of this PR.
 */
export type SearchFilterDimension =
  | 'rewaya' // Reciter.rewayat[].name — teacher/student (already bespoke; here for future migration)
  | 'has-surah' // surah picker → Reciter.rewayat[].surah_list includes (already bespoke; here for future migration)
  | 'has-photo' // Reciter.image_url present
  | 'recitation-style'; // Reciter.rewayat[].style — canonical slugs 'murattal'|'mojawwad'|'moalim' per data/rewayat-slugs.json (already bespoke; here for future migration)

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
   * RFC-012 — composable Search-tab filter dimensions. When set, the
   * Search tab renders a user-editable chip per id; tiles on the Home
   * tab can deeplink in with chips pre-applied via the matching URL
   * params on the `reciter/browse` route. RFC-012 chips render AFTER
   * Bayaan's existing bespoke chips (teacher/student) — trailing
   * position is intentional so users of a forked build see the
   * familiar chips first and the fork's additions after.
   *
   * Tri-state semantics:
   *   - `undefined` (default) — "not migrated"; Search tab keeps
   *     today's bespoke chip set unchanged. Bayaan ships this.
   *   - `[]` — "explicitly disable all RFC-012 chips". Observably the
   *     same as `undefined` today, but the intent is distinct for
   *     future v2 migration when bespoke chips themselves move under
   *     this seam.
   *   - non-empty array — opt in to the listed dimensions.
   *
   * v1 ships exists-today dimensions only — see `SearchFilterDimension`.
   *
   * @example
   * searchFilters: ['rewaya', 'has-surah', 'has-photo']
   */
  searchFilters?: SearchFilterDimension[];
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
}

declare const branding: Branding;
export default branding;
