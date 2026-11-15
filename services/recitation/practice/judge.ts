import {shownFlags} from '../flags';
import type {TakeRecord} from '../take';
import type {PracticeTarget, PracticeVerdict} from './types';

// How a practice take went, from its record alone. Only shown flag kinds
// count, and flags the reader dismissed do not.

function ayatOf(target: PracticeTarget): string[] {
  if (target.accept) return [...target.accept];
  const passage = target.expected;
  if (!passage) return [];
  const keys: string[] = [];
  for (let a = passage.ayah; a <= (passage.ayahEnd ?? passage.ayah); a++) {
    keys.push(`${passage.surah}:${a}`);
  }
  return keys;
}

export function judgePractice(
  target: PracticeTarget,
  take: TakeRecord,
  dismissed: ReadonlySet<string>,
): PracticeVerdict {
  const flags = shownFlags(take.flags, dismissed);
  const recited = take.ayat;
  if (recited.length === 0 && flags.length === 0) {
    return {outcome: 'nothing', flags, recited};
  }
  const wanted = new Set(ayatOf(target));
  const heard = new Set(recited.map(a => `${a.surah}:${a.ayah}`));
  const hits = [...heard].filter(key => wanted.has(key));
  if (hits.length === 0 && flags.length === 0) {
    return {outcome: 'other', flags, recited};
  }
  if (flags.length > 0) return {outcome: 'flagged', flags, recited};
  // Tracking targets accept any one of their ayat; passages need them all.
  const complete = target.accept
    ? hits.length > 0
    : hits.length === wanted.size;
  return {outcome: complete ? 'clean' : 'partial', flags, recited};
}
