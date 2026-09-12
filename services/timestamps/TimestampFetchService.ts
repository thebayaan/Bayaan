import branding from '@/config/branding';
import {RECITERS, type Rewayat} from '@/data/reciterData';
import {timestampDatabaseService} from './TimestampDatabaseService';
import type {AyahTimestamp} from '@/types/timestamps';

// RFC-015 — fork-supplied timestamp CDN base. Absent from `branding.js`
// → fallback to Bayaan's production CDN (byte-equivalent to the
// pre-RFC-015 hardcoded value). Forks set `branding.timestampCdnBase`
// to their own mirror's base. The URL is composed below as
// `${R2_BASE}/${rewayatId}/${paddedSurah}.json`.
//
// The JSDoc on `branding.timestampCdnBase` documents "no trailing
// slash", but a fork typo (`'https://cdn.myfork.com/timestamps/'`)
// would compose `…/timestamps//rewayat-id/001.json` and silently 404
// every lookup against R2 / most CDNs that don't normalize doubled
// slashes. Strip a trailing slash defensively so the runtime matches
// the contract regardless of the fork-side value.
const R2_BASE = (
  branding.timestampCdnBase ?? 'https://cdn.thebayaan.com/timestamps'
).replace(/\/+$/, '');

// Minimal per-element shape check for the fetched JSON. The cast
// `as AyahTimestamp[]` existed pre-RFC, but this RFC widens the set
// of CDN operators to fork maintainers — a structurally wrong JSON
// (snake-cased fields from a raw mp3quran upload, an old shape
// without `durationMs`, etc.) would land `undefined` in the SQLite
// `duration_ms` column and corrupt the ayah-highlight offsets.
// Cheap first-element probe is enough to catch the obvious cases
// without pulling in a runtime validator.
function isAyahTimestampShape(x: unknown): x is AyahTimestamp {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.surahNumber === 'number' &&
    typeof o.ayahNumber === 'number' &&
    typeof o.timestampFrom === 'number' &&
    typeof o.timestampTo === 'number' &&
    typeof o.durationMs === 'number'
  );
}

class TimestampFetchService {
  /**
   * RFC-019 — fork-supplied bundled-timestamp coverage for a rewayat, as an
   * EXACT allow-list. Reads the explicit coverage signal
   * (`branding.timestampLocalSurahList`) and never probes the data provider, so
   * a partial-coverage reciter whose bundle omits surah 1 is not falsely
   * suppressed. `?? []` keeps Bayaan's behavior identical when the field is
   * unset (empty list → no local coverage anywhere).
   *
   * NOTE: unlike the R2 `timestamps_surah_list` path, an empty list here means
   * "no local coverage", NOT "all surahs" — membership is exact.
   */
  private localSurahs(rewayatId: string): number[] {
    // Guard the fork-supplied provider exactly like the `timestampLocalProvider`
    // data path below: a throwing `timestampLocalSurahList` must not propagate
    // into the follow-along UI — guarding fork-supplied code is the whole point
    // of the seam, and leaving the coverage path unguarded while the data path
    // is wrapped is an inconsistent asymmetry.
    try {
      return branding.timestampLocalSurahList?.(rewayatId) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Returns true if a rewayat has any timestamp coverage from EITHER a
   * fork-supplied bundled (`'local'`) dataset (RFC-019) OR R2
   * (`has_timestamps`, set by the mirror script).
   *
   * Local coverage BYPASSES `has_timestamps` — a reciter need not carry the R2
   * flag for bundled timings to apply.
   */
  hasSource(rewayatId: string): boolean {
    // Any local coverage at all counts as a source (RFC-019), independent of
    // the catalog's R2 `has_timestamps` flag.
    if (this.localSurahs(rewayatId).length > 0) return true;
    const rw = this.findRewayat(rewayatId);
    return Boolean(rw?.has_timestamps);
  }

  /**
   * Returns true if timestamps cover this specific surah from EITHER the
   * fork-supplied bundle (RFC-019, exact allow-list membership) OR R2.
   *
   * The local branch is an EXACT allow-list (`includes(surahNumber)`) and
   * bypasses `has_timestamps`. The R2 branch is unchanged: it gates on
   * `has_timestamps` and treats an absent/empty `timestamps_surah_list` as
   * "all surahs".
   */
  hasSurah(rewayatId: string, surahNumber: number): boolean {
    // RFC-019 local coverage: exact allow-list, no `has_timestamps` gate.
    if (this.localSurahs(rewayatId).includes(surahNumber)) return true;
    return this.r2HasSurah(this.findRewayat(rewayatId), surahNumber);
  }

  /**
   * R2-only surah coverage — the unchanged pre-RFC-019 behavior: gate on
   * `has_timestamps`, treat an absent/empty `timestamps_surah_list` as "all
   * surahs". Split out so `fetchAndCache` can evaluate the R2 path from an
   * already-resolved local-coverage list without invoking the local provider a
   * second time.
   */
  private r2HasSurah(rw: Rewayat | undefined, surahNumber: number): boolean {
    if (!rw?.has_timestamps) return false;
    if (!rw.timestamps_surah_list || rw.timestamps_surah_list.length === 0) {
      return true;
    }
    return rw.timestamps_surah_list.includes(surahNumber);
  }

  async fetchAndCache(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    // RFC-019 — a fork-supplied bundled (`'local'`) dataset wins over R2
    // (Open question 3), but ONLY when the coverage allow-list claims this
    // surah AND the provider returns a well-shaped array. Writing source
    // `'local'` into the SQLite cache means subsequent reads short-circuit at
    // TimestampService's SQLite step — no network. When unset, both `?? null`
    // coalesces short-circuit and this block is inert (byte-equivalent to
    // today).
    // Resolve the fork's local coverage once; reused for both the local-wins
    // branch and the R2 guard below so `timestampLocalSurahList` is invoked a
    // single time per call (the provider is contracted side-effect-free).
    const localList = this.localSurahs(rewayatId);
    if (localList.includes(surahNumber)) {
      const local =
        branding.timestampLocalProvider?.(rewayatId, surahNumber) ?? null;
      // Same first-element shape probe the R2 path runs (added in the RFC-015
      // review): fork-authored bundles are an untrusted-shape source too. A
      // malformed entry (snake_cased fields, a missing `durationMs`, an old
      // shape) would otherwise land `undefined` in the SQLite `duration_ms`
      // column and produce NaN highlight offsets.
      if (
        Array.isArray(local) &&
        local.length > 0 &&
        isAyahTimestampShape(local[0])
      ) {
        // NOTE (fork authors): a `'local'`-sourced surah is immutable once
        // cached — `isSurahCached` keys on (rewayat, surah) and ignores
        // `source`, so a subsequently shipped/updated bundle won't be picked up
        // until the timestamp cache is reset.
        await timestampDatabaseService.writeTimestamps(
          rewayatId,
          surahNumber,
          local,
          'local',
        );
        return local;
      }
      // Coverage claimed but data missing/malformed → fall through to the R2
      // path rather than caching garbage.
    }

    // Proceed to R2 when the local list claimed this surah (retry after a
    // malformed local payload) or R2 itself covers it. Reuses `localList` and
    // the extracted R2 check instead of `hasSurah`, which would re-invoke the
    // local provider.
    if (
      !localList.includes(surahNumber) &&
      !this.r2HasSurah(this.findRewayat(rewayatId), surahNumber)
    ) {
      return null;
    }

    const padded = String(surahNumber).padStart(3, '0');
    const url = `${R2_BASE}/${rewayatId}/${padded}.json`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(
          `[TimestampFetch] R2 ${res.status} for ${rewayatId} surah ${surahNumber}`,
        );
        return null;
      }
      const raw = (await res.json()) as unknown;
      if (!Array.isArray(raw) || raw.length === 0) return null;
      if (!isAyahTimestampShape(raw[0])) {
        console.warn(
          `[TimestampFetch] Unexpected JSON shape for ${rewayatId} surah ${surahNumber}; skipping`,
        );
        return null;
      }
      const data = raw as AyahTimestamp[];

      await timestampDatabaseService.writeTimestamps(
        rewayatId,
        surahNumber,
        data,
        'r2',
      );

      return data;
    } catch (error) {
      console.warn(
        `[TimestampFetch] Failed to fetch ${rewayatId} surah ${surahNumber}:`,
        error,
      );
      return null;
    }
  }

  private findRewayat(rewayatId: string): Rewayat | undefined {
    for (const reciter of RECITERS) {
      const rw = reciter.rewayat.find(r => r.id === rewayatId);
      if (rw) return rw;
    }
    return undefined;
  }
}

export const timestampFetchService = new TimestampFetchService();
