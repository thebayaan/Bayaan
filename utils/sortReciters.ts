// @ai-generated
import type {Reciter} from '@/data/reciterData';
import {toSearchKey} from '@/utils/search/normalize';

/**
 * Sorts reciters A–Z by name in one run, ignoring case, accents and
 * punctuation ("Al-Dosari" sorts with "Al Dosari"). Returns a new array.
 */
export function sortRecitersByName<T extends Pick<Reciter, 'id' | 'name'>>(
  reciters: readonly T[],
): T[] {
  return reciters
    .map(reciter => ({reciter, key: toSearchKey(reciter.name)}))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      if (a.reciter.id === b.reciter.id) return 0;
      return a.reciter.id < b.reciter.id ? -1 : 1;
    })
    .map(({reciter}) => reciter);
}
