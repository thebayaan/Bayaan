// @ai-generated
/**
 * The options behind a Continue Listening card (long press on Home).
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import type {Reciter} from '@/data/reciterData';
import {SURAHS, type Surah} from '@/data/surahData';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({queue: {tracks: [], currentIndex: 0}})},
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn(), hide: jest.fn()},
}));
jest.mock('expo-router', () => ({useRouter: () => ({push: jest.fn()})}));
jest.mock('@/hooks/useFavoriteReciters', () => ({
  useFavoriteReciters: () => ({
    isFavoriteReciter: () => false,
    toggleFavorite: jest.fn(),
  }),
}));
jest.mock('@/hooks/useLoved', () => ({
  useLoved: () => ({isLovedWithRewayat: () => false, toggleLoved: jest.fn()}),
}));
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({addToQueue: jest.fn()}),
}));
jest.mock('@/services/dataService', () => ({
  getReciterById: jest.fn(),
  getSurahById: () => undefined,
}));
jest.mock('@/utils/audioUtils', () => ({generateSmartAudioUrl: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));
jest.mock('@/utils/shareUtils', () => ({
  recitationShareUrl: jest.fn(),
  reciterShareUrl: jest.fn(),
  shareUrl: jest.fn(),
}));
jest.mock('../OptionsMenu', () => ({
  OptionsMenuView: () => null,
  useNativeOptionsMenu: () => false,
}));

import {
  useHomeCardOptions,
  type HomeCardOptionsPayload,
} from '../homeCardOptions';
import {findRecentIndex} from '@/components/cards/recentCardEntry';
import {
  useRecentlyPlayedStore,
  type RecentlyPlayedTrack,
} from '@/services/player/store/recentlyPlayedStore';

type Options = ReturnType<typeof useHomeCardOptions>;

const close = jest.fn();
let options!: Options;

function Probe({payload}: {payload: HomeCardOptionsPayload}) {
  options = useHomeCardOptions(payload, close);
  return null;
}

/** Opens the options for a card, as a long press on it does. */
function open(payload: HomeCardOptionsPayload) {
  act(() => {
    TestRenderer.create(<Probe payload={payload} />);
  });
}

const reciter = (id: string) =>
  ({id, name: `Reciter ${id}`, rewayat: [{id: `${id}-hafs`}]} as Reciter);
const surah = (id: number) => SURAHS.find(s => s.id === id) as Surah;

const entry = (reciterId: string, surahId: number): RecentlyPlayedTrack => ({
  reciter: reciter(reciterId),
  surah: surah(surahId),
  rewayatId: `${reciterId}-hafs`,
  progress: 0,
  duration: 0,
  timestamp: 0,
});
const uploadEntry = (uploadId: string): RecentlyPlayedTrack => ({
  ...entry('__uploads__', 1),
  rewayatId: '',
  isUserUpload: true,
  userRecitationId: uploadId,
});

/** The card for an entry: what RecentReciterCard hands the options. */
const cardFor = (track: RecentlyPlayedTrack): HomeCardOptionsPayload => ({
  reciterId: track.reciter.id,
  reciterName: track.reciter.name,
  surahId: track.surah.id,
  surahName: track.surah.name,
  rewayatId: track.isUserUpload ? undefined : track.rewayatId,
  userRecitationId: track.userRecitationId,
  variant: 'recent',
});

const setRecents = (recentTracks: RecentlyPlayedTrack[]) =>
  useRecentlyPlayedStore.setState({recentTracks});
const cards = () =>
  useRecentlyPlayedStore
    .getState()
    .recentTracks.map(
      t => t.userRecitationId ?? `${t.reciter.id}:${t.surah.id}`,
    );

beforeEach(() => {
  jest.clearAllMocks();
  setRecents([]);
});

describe('Remove from recents', () => {
  it('removes the card that was pressed', () => {
    setRecents([entry('A', 2), entry('B', 36), entry('C', 18)]);
    open(cardFor(entry('B', 36)));

    act(() => options.handleRemoveFromRecents());

    expect(cards()).toEqual(['A:2', 'C:18']);
    expect(close).toHaveBeenCalledTimes(1);
  });

  // The queue moved on to another reciter while the options were open, which
  // puts a new card at the front. Removing by the position the card had when
  // it was pressed took out the card before it.
  it('removes it after a new card has arrived at the front', () => {
    setRecents([entry('A', 2), entry('B', 36), entry('C', 18)]);
    open(cardFor(entry('B', 36)));

    act(() => setRecents([entry('D', 67), entry('A', 2), entry('B', 36)]));
    act(() => options.handleRemoveFromRecents());

    expect(cards()).toEqual(['D:67', 'A:2']);
  });

  it("removes an upload's card by the upload, not by its reciter and surah", () => {
    setRecents([uploadEntry('u1'), entry('A', 2), uploadEntry('u2')]);
    open(cardFor(uploadEntry('u2')));

    act(() => options.handleRemoveFromRecents());

    expect(cards()).toEqual(['u1', 'A:2']);
  });

  it('still removes the card when playback moved it on to the next surah', () => {
    setRecents([entry('A', 2), entry('B', 36)]);
    open(cardFor(entry('A', 2)));

    // Auto-advance rewrites the reciter's card in place.
    act(() => setRecents([entry('A', 3), entry('B', 36)]));
    act(() => options.handleRemoveFromRecents());

    expect(cards()).toEqual(['B:36']);
  });

  it('removes nothing when the card is already gone', () => {
    setRecents([entry('A', 2), entry('B', 36)]);
    open(cardFor(entry('C', 18)));

    act(() => options.handleRemoveFromRecents());

    expect(cards()).toEqual(['A:2', 'B:36']);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('findRecentIndex', () => {
  const indexOf = (reciterId: string, surahId: number, rewayatId: string) =>
    findRecentIndex({reciterId, surahId, rewayatId});

  it('counts entries Home leaves out', () => {
    const broken = {...entry('gone', 1), surah: undefined} as unknown;
    setRecents([entry('A', 2), broken as RecentlyPlayedTrack, entry('B', 36)]);

    expect(indexOf('B', 36, 'B-hafs')).toBe(2);
  });

  it("does not take an upload's card for the catalogue card of its reciter", () => {
    const tagged = {
      ...uploadEntry('u1'),
      reciter: reciter('A'),
      surah: surah(2),
    };
    setRecents([tagged, entry('A', 2)]);

    expect(indexOf('A', 2, 'A-hafs')).toBe(1);
    expect(findRecentIndex({reciterId: 'A', userRecitationId: 'u1'})).toBe(0);
  });

  it('prefers the exact rewayah when a reciter has two cards', () => {
    const warsh = {...entry('A', 2), rewayatId: 'A-warsh'};
    setRecents([entry('A', 2), warsh]);

    expect(indexOf('A', 2, 'A-warsh')).toBe(1);
  });
});
