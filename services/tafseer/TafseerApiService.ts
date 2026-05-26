import branding from '@/config/branding';
import {quranComTafsirProvider} from './QuranComTafsirProvider';

/**
 * RFC-009 — tafsir source resolver.
 *
 * `tafseerApiService` resolves to the fork-supplied
 * `branding.tafsirProvider` when set, otherwise to Bayaan's default
 * api.quran.com-backed `quranComTafsirProvider`. The exported name and
 * shape are unchanged, so consumers (`store/tafseerStore.ts`) are
 * untouched.
 */
export const tafseerApiService =
  branding.tafsirProvider ?? quranComTafsirProvider;

// `TafseerVerse` moved to `types/tafseer.ts` (RFC-009). Re-exported here
// so any importer of the previous location keeps compiling.
export type {TafseerVerse} from '@/types/tafseer';
