// @ai-generated
import type {Reciter} from '@/data/reciterData';
import {toSearchKey} from '@/utils/search/normalize';
import {getReciterDisplayName} from '@/i18n/format';

/**
 * Sorts reciters A–Z by the name that is shown, in one run, ignoring case,
 * accents and punctuation ("Al-Dosari" sorts with "Al Dosari"). Returns a
 * new array.
 *
 * The shown name, not `name`: in Arabic the list shows Arabic names, and
 * sorted by the English ones it read as random (عبد... and أحمد together
 * under "A", إبراهيم in the middle under "I").
 */
export function sortRecitersByName<
  T extends Pick<Reciter, 'id' | 'name'> & {name_arabic?: string | null},
>(reciters: readonly T[]): T[] {
  return reciters
    .map(reciter => ({
      reciter,
      key: toSearchKey(
        getReciterDisplayName({
          id: reciter.id,
          name: reciter.name,
          name_arabic: reciter.name_arabic ?? undefined,
        }),
      ),
    }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      if (a.reciter.id === b.reciter.id) return 0;
      return a.reciter.id < b.reciter.id ? -1 : 1;
    })
    .map(({reciter}) => reciter);
}
