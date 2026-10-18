import {PIGMENTS} from '../../theme/surahColors';
import type {AdhkarList} from '../../data/adhkarLists';
import {estimateDhikrMinutes} from '../adhkarBrowse';

const INK = '#06151c';

/** Mixes `hex` toward the brand ink, `amount` (0..1) of the colour kept. */
export function towardInk(hex: string, amount: number): string {
  const parse = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const a = hex.replace('#', '');
  const b = INK.replace('#', '');
  const mix = (i: number) =>
    Math.round(parse(a, i) * amount + parse(b, i) * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

// Times of day get the manuscript pigments of the design (dawn saffron,
// dusk madder, night indigo); other lists take theirs from the phone's
// colour, pulled toward ink so cream text reads on it.
const TIME_PIGMENTS: Record<string, readonly [string, string]> = {
  'morning-adhkar': [PIGMENTS.saffron, PIGMENTS.ochre],
  'waking-up': [PIGMENTS.saffron, PIGMENTS.verdigris],
  'evening-adhkar': [PIGMENTS.madder, PIGMENTS.indigo],
  'before-sleep': [PIGMENTS.indigo, PIGMENTS.lapis],
};

export function adhkarGradient(list: AdhkarList): readonly [string, string] {
  const pigments = TIME_PIGMENTS[list.id];
  if (pigments)
    return [towardInk(pigments[0], 0.7), towardInk(pigments[1], 0.45)];
  return [towardInk(list.color, 0.55), towardInk(list.color, 0.25)];
}

/** When a list is said, for its tile ("After Fajr"). */
export const ADHKAR_WHEN: Readonly<Record<string, string>> = {
  'morning-adhkar': 'After Fajr',
  'evening-adhkar': 'After Asr',
  'before-sleep': 'At bedtime',
  'waking-up': 'On waking',
  'after-salah': 'After each prayer',
};

/**
 * Roughly how long a list takes to say, in minutes: the Adhkar screen's
 * estimate, so Search, Home and Adhkar agree.
 */
export function estimateMinutes(
  dhikrs: readonly {arabic: string; repeatCount: number}[],
): number {
  return estimateDhikrMinutes(dhikrs);
}

export function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'dhikr' : 'adhkar'}`;
}
