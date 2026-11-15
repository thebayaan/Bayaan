import type {TakeFlag} from './take';

// The engine's flags as the reader sees them. Only kinds with good precision
// on real recitations are shown (phase-3-research.md): vowel, unclear-ayah
// and repetition flags never are. Every wording says "may have".

export type FlagKind =
  | 'skippedAyah'
  | 'skippedWord'
  | 'similarAyah'
  | 'differentWord';

export interface ShownFlag {
  kind: FlagKind;
  surah: number;
  ayah: number;
  /** 0-based word in Tilawa's segmentation; 0 for ayah-level kinds. */
  word: number;
  /** Stable identity, also used to remember "I read it correctly". */
  key: string;
  /** Words in the ayah in Tilawa's segmentation, when the engine said. */
  totalWords?: number;
}

export function flagKey(flag: {
  kind: FlagKind;
  surah: number;
  ayah: number;
  word: number;
}): string {
  return `${flag.kind}:${flag.surah}:${flag.ayah}:${flag.word}`;
}

function kindOf(flag: TakeFlag): FlagKind | null {
  switch (flag.kind) {
    case 'possible_skipped_ayah':
      return 'skippedAyah';
    case 'possible_omission':
      return 'skippedWord';
    case 'possible_substitution':
      return flag.source === 'similar_verse' ? 'similarAyah' : 'differentWord';
    default:
      return null;
  }
}

/** The flag as shown, or null for kinds that are never shown. */
export function toShownFlag(flag: TakeFlag): ShownFlag | null {
  const kind = kindOf(flag);
  if (!kind) return null;
  // Ayah-level kinds are about the whole ayah, so a dismissal holds for it.
  const ayahLevel = kind === 'skippedAyah' || kind === 'similarAyah';
  const shown = {
    kind,
    surah: flag.surah,
    ayah: flag.ayah,
    word: ayahLevel ? 0 : flag.word,
  };
  return {...shown, key: flagKey(shown)};
}

/** The flags to show: deduped, without dismissed ones, in mushaf order. */
export function shownFlags(
  flags: readonly TakeFlag[],
  dismissed: ReadonlySet<string>,
): ShownFlag[] {
  const byKey = new Map<string, ShownFlag>();
  for (const flag of flags) {
    const shown = toShownFlag(flag);
    if (shown && !dismissed.has(shown.key)) byKey.set(shown.key, shown);
  }
  return [...byKey.values()].sort(
    (a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word,
  );
}
