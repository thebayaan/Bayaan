// @ai-generated
/**
 * The follow-along band the mushaf pages read from the player store: what
 * the current timing entry recites (Hafs keys) and in which numbering, so
 * playbackBandUnitKeys can light exactly the shown rewayah's verse units.
 * Its Hafs keys are exactly what the band painted before
 * (usePlaybackVerseKeys / selectPlaybackVerseKeysId of the release base).
 */
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: jest.fn(),
}));

import {parsePlaybackBandId, selectPlaybackBandId} from '../playbackBand';
import {NO_PLAYBACK_BAND} from '../verseHighlightLayers';
import {parseVerseKeyListId, verseKeyListId} from '@/utils/timestampNumbering';

type BandState = Parameters<typeof selectPlaybackBandId>[0];

function state(overrides: Partial<BandState>): BandState {
  return {
    playbackState: 'playing',
    currentVerseKey: null,
    currentVerseKeys: [],
    currentReciterVerseKey: null,
    numberingMode: null,
    _numbering: null,
    ...overrides,
  } as BandState;
}

/** selectPlaybackVerseKeysId of the release base (store/mushafPlayerStore). */
function baseSelectPlaybackVerseKeysId(s: BandState): string {
  if (s.playbackState === 'idle') return '';
  if (s.currentVerseKeys.length > 0) return verseKeyListId(s.currentVerseKeys);
  return s.currentVerseKey ?? '';
}

const warshNumbering = {reciterRewayah: 'warsh'} as BandState['_numbering'];

describe('selectPlaybackBandId / parsePlaybackBandId', () => {
  it('nothing while idle or before an entry is tracked', () => {
    expect(
      selectPlaybackBandId(
        state({playbackState: 'idle', currentVerseKeys: ['2:1']}),
      ),
    ).toBe('');
    expect(selectPlaybackBandId(state({}))).toBe('');
    expect(parsePlaybackBandId('')).toBe(NO_PLAYBACK_BAND);
  });

  it('a Warsh-numbered entry: its Hafs verses, the numbering and the entry', () => {
    const id = selectPlaybackBandId(
      state({
        currentVerseKey: '2:1',
        currentVerseKeys: ['2:1', '2:2'],
        currentReciterVerseKey: '2:1',
        numberingMode: 'riwayah',
        _numbering: warshNumbering,
      }),
    );
    expect(parsePlaybackBandId(id)).toEqual({
      hafsKeys: ['2:1', '2:2'],
      mode: 'riwayah',
      reciterRewayah: 'warsh',
      entryKey: '2:1',
    });
  });

  it('a Hafs entry with only currentVerseKey', () => {
    expect(
      parsePlaybackBandId(
        selectPlaybackBandId(
          state({currentVerseKey: '2:255', numberingMode: 'hafs'}),
        ),
      ),
    ).toEqual({
      hafsKeys: ['2:255'],
      mode: 'hafs',
      reciterRewayah: null,
      entryKey: null,
    });
  });

  it('value-comparable: equal states give equal ids, another entry another id', () => {
    const a = state({
      currentVerseKey: '1:7',
      currentVerseKeys: ['1:7'],
      currentReciterVerseKey: '1:6',
      numberingMode: 'riwayah',
      _numbering: warshNumbering,
    });
    expect(selectPlaybackBandId({...a})).toBe(selectPlaybackBandId(a));
    // Warsh 1:6 then Warsh 1:7 recite the same Hafs verse: the band moves.
    expect(
      selectPlaybackBandId({...a, currentReciterVerseKey: '1:7'}),
    ).not.toBe(selectPlaybackBandId(a));
  });

  it('its Hafs keys are what the band painted before, in every state', () => {
    const states: BandState[] = [];
    for (const playbackState of ['idle', 'playing', 'paused'] as const) {
      for (const currentVerseKey of [null, '2:1']) {
        for (const currentVerseKeys of [[], ['2:1'], ['2:1', '2:2']]) {
          states.push(
            state({
              playbackState: playbackState as BandState['playbackState'],
              currentVerseKey,
              currentVerseKeys,
            }),
          );
        }
      }
    }
    for (const s of states) {
      expect(parsePlaybackBandId(selectPlaybackBandId(s)).hafsKeys).toEqual(
        parseVerseKeyListId(baseSelectPlaybackVerseKeysId(s)),
      );
    }
  });
});
