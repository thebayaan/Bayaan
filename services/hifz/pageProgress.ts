import {shownFlags} from '@/services/recitation/flags';
import type {TakeRecord} from '@/services/recitation/take';
import {pageStrength, type PageState, type PageVisit} from './strength';

// Page visits from logged takes. Only recitation from memory counts as
// revision: hidden-text takes and practice takes. A page's visit is clean
// when the take left nothing to check and no peeks on it.

export function pageVisits(
  takes: readonly TakeRecord[],
  dismissed: ReadonlySet<string>,
  pageOf: (verseKey: string) => number | undefined,
): Map<number, PageVisit[]> {
  const visits = new Map<number, PageVisit[]>();
  for (const take of takes) {
    if (!take.hidden && take.purpose !== 'practice') continue;
    const covered = new Set<number>();
    for (const a of take.ayat) {
      const page = pageOf(`${a.surah}:${a.ayah}`);
      if (page) covered.add(page);
    }
    const unclean = new Set<number>();
    for (const flag of shownFlags(take.flags, dismissed)) {
      const page = pageOf(`${flag.surah}:${flag.ayah}`);
      if (page) unclean.add(page);
    }
    for (const peek of take.peeks) {
      const page = pageOf(`${peek.surah}:${peek.ayah}`);
      if (page) unclean.add(page);
    }
    for (const page of covered) {
      const list = visits.get(page) ?? [];
      list.push({at: take.startedAt, clean: !unclean.has(page)});
      visits.set(page, list);
    }
  }
  return visits;
}

export function pageStates(
  visits: ReadonlyMap<number, readonly PageVisit[]>,
  now: number,
): Map<number, PageState> {
  const states = new Map<number, PageState>();
  for (const [page, list] of visits) states.set(page, pageStrength(list, now));
  return states;
}
