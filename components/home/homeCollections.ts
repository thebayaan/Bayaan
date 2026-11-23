// @ai-generated
// The reciter collections Home groups in one panel, each opening its own
// list (app/(tabs)/(a.home)/reciters/[collection].tsx). They were six
// shelves on the old Home.
import type {Reciter} from '@/data/reciterData';
import type {HomeRowId} from '@/config/branding';
import {
  getBayaanOriginalsReciters,
  getBeginnerFriendlyReciters,
  getFeaturedReciters,
  getFollowAlongReciters,
  getMemorizationReciters,
  getTajweedReciters,
} from '@/data/reciterCollections';

export type HomeCollectionId =
  | 'featured'
  | 'new-to-quran'
  | 'tajweed'
  | 'memorization'
  | 'follow-along'
  | 'exclusives';

interface HomeCollection {
  id: HomeCollectionId & HomeRowId;
  /** Key in the home namespace for the collection's name. */
  titleKey:
    | 'home.featuredReciters'
    | 'collections.newToQuran'
    | 'home.bestForTajweed'
    | 'home.bestForMemorization'
    | 'home.followAlong'
    | 'home.exclusives';
  reciters: () => Reciter[];
}

export const HOME_COLLECTIONS: readonly HomeCollection[] = [
  {
    id: 'featured',
    titleKey: 'home.featuredReciters',
    reciters: () => getFeaturedReciters(),
  },
  {
    id: 'new-to-quran',
    titleKey: 'collections.newToQuran',
    reciters: () => getBeginnerFriendlyReciters(),
  },
  {
    id: 'tajweed',
    titleKey: 'home.bestForTajweed',
    reciters: () => getTajweedReciters(),
  },
  {
    id: 'memorization',
    titleKey: 'home.bestForMemorization',
    reciters: () => getMemorizationReciters(),
  },
  {
    id: 'follow-along',
    titleKey: 'home.followAlong',
    reciters: () => getFollowAlongReciters(),
  },
  {
    id: 'exclusives',
    titleKey: 'home.exclusives',
    reciters: () => getBayaanOriginalsReciters(),
  },
];

export function findHomeCollection(id: string | undefined) {
  return HOME_COLLECTIONS.find(c => c.id === id);
}
