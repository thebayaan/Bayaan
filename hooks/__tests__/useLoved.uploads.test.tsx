// @ai-generated
/**
 * The player's heart goes through isTrackLoved / toggleTrackLoved. For an
 * upload they passed only its reciter, surah and rewayah, so the heart loved
 * the catalogue recording of that surah and Loved later played that instead
 * of the upload.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import type {Track} from '@/types/audio';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackFavoriteToggled: jest.fn()},
}));

import {useLoved} from '../useLoved';
import {useLovedStore} from '@/services/player/store/lovedStore';

type Loved = ReturnType<typeof useLoved>;

let loved!: Loved;
let renderer: TestRenderer.ReactTestRenderer | null = null;

function Probe() {
  loved = useLoved();
  return null;
}

const track = (over: Partial<Track>): Track => ({
  id: 't',
  url: 'file:///t.mp3',
  title: 'Ya-Sin',
  artist: 'Reciter',
  reciterId: 'reciter-a',
  reciterName: 'Reciter',
  surahId: '36',
  ...over,
});

// A tagged upload as createUserUploadTrack builds it: its rewayah tag may
// resolve to one of the reciter's real rewayat.
const upload = track({
  id: 'upload-u1',
  rewayatId: 'rewayah-hafs',
  isUserUpload: true,
  userRecitationId: 'u1',
});
const catalogue = track({id: 'reciter-a-36', rewayatId: 'rewayah-hafs'});

const saved = () =>
  useLovedStore
    .getState()
    .tracks.map(({timestamp: _timestamp, ...rest}) => rest);

beforeEach(() => {
  useLovedStore.setState({tracks: []});
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

it('the heart on an upload loves the upload itself', () => {
  act(() => loved.toggleTrackLoved(upload));

  expect(saved()).toEqual([
    {
      reciterId: 'reciter-a',
      surahId: '36',
      rewayatId: '',
      userRecitationId: 'u1',
    },
  ]);
  expect(loved.isTrackLoved(upload)).toBe(true);
  // The catalogue recording of the same surah is a different thing.
  expect(loved.isTrackLoved(catalogue)).toBe(false);
});

it('the heart on an upload does not light up for a loved catalogue recording', () => {
  act(() => loved.toggleTrackLoved(catalogue));

  expect(loved.isTrackLoved(catalogue)).toBe(true);
  expect(loved.isTrackLoved(upload)).toBe(false);
});

it('a second tap unloves the upload and nothing else', () => {
  act(() => loved.toggleTrackLoved(catalogue));
  act(() => loved.toggleTrackLoved(upload));
  act(() => loved.toggleTrackLoved(upload));

  expect(saved()).toEqual([
    {
      reciterId: 'reciter-a',
      surahId: '36',
      rewayatId: 'rewayah-hafs',
      userRecitationId: undefined,
    },
  ]);
});

it('an upload with no reciter or surah cannot be loved', () => {
  const untagged = track({
    id: 'upload-u2',
    reciterId: '',
    surahId: undefined,
    userRecitationId: 'u2',
  });

  act(() => loved.toggleTrackLoved(untagged));

  expect(saved()).toEqual([]);
  expect(loved.isTrackLoved(untagged)).toBe(false);
});

it('returns the same sorted list until the saved tracks change', () => {
  act(() => loved.toggleTrackLoved(catalogue));
  const first = loved.lovedTracks;

  // Re-render without a change to the store.
  act(() => {
    renderer?.update(<Probe />);
  });
  expect(loved.lovedTracks).toBe(first);

  act(() => loved.toggleTrackLoved(upload));
  expect(loved.lovedTracks).not.toBe(first);
  expect(loved.lovedTracks).toHaveLength(2);
});
