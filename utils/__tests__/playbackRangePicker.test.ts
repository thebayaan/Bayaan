// @ai-generated
/**
 * The mushaf player's range pickers pick among the verses of the mushaf on
 * screen, in its own numbering (verse-units contract 4.2), with real verse
 * units of real Release 1 word slots. A Hafs mushaf keeps its Hafs pickers
 * exactly; a mushaf whose verse units are not available picks Hafs verses
 * and labels them as Hafs.
 */

jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: jest.fn()},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {getOrderedVerseKeysForPage: () => []},
}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: {getState: () => ({rewayah: 'hafs'})},
}));
jest.mock('@/utils/playbackVerseUnits', () => ({
  readyVerseUnits: () => null,
  canShowRewayahVerses: () => true,
  subscribeVerseUnitsChanges: () => () => undefined,
}));

import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {
  fixtureUnit,
  fixtureVerseUnits,
} from '@/services/timestamps/__fixtures__/verseUnitFixtures';
import {
  pickerDefaults,
  pickerPendingStart,
  pickerSelection,
  pickerVerseCount,
  pickerVerseLabel,
  rangePickerNumbering,
} from '../playbackRangePicker';

const st = () => useMushafPlayerStore.getState();
const warsh = () => rangePickerNumbering('warsh', fixtureVerseUnits('warsh'));
const hafs = rangePickerNumbering('hafs', null);

beforeEach(() => {
  st().clearRange();
  st().setPendingStart(null);
});

describe('numbering', () => {
  it("is the mushaf rewayah's own while its verse units are ready", () => {
    expect(warsh()).toMatchObject({rewayah: 'warsh', hafsFallback: false});
    expect(rangePickerNumbering('warsh', null)).toEqual({
      rewayah: 'hafs',
      units: null,
      hafsFallback: true,
    });
    // units of another rewayah never number this mushaf
    expect(
      rangePickerNumbering('qalun', fixtureVerseUnits('warsh')).hafsFallback,
    ).toBe(true);
    expect(hafs).toEqual({rewayah: 'hafs', units: null, hafsFallback: false});
  });

  it('grids and labels in that numbering', () => {
    expect(pickerVerseCount(warsh(), 1)).toBe(7);
    expect(pickerVerseCount(warsh(), 103)).toBe(3);
    expect(pickerVerseCount(hafs, 103)).toBe(3);
    expect(pickerVerseCount(hafs, 2)).toBe(286);
    expect(
      pickerVerseCount(
        rangePickerNumbering('al-bazzi', fixtureVerseUnits('bazzi')),
        112,
      ),
    ).toBe(5);
    expect(pickerVerseLabel(warsh(), '1:7')).toBe('Al-Fatihah 1:7');
    expect(pickerVerseLabel(hafs, '2:255')).toBe('Al-Baqarah 2:255');
    expect(pickerVerseLabel(rangePickerNumbering('warsh', null), '1:7')).toBe(
      'Al-Fatihah 1:7 (Hafs)',
    );
  });
});

describe('defaults', () => {
  it('Hafs: the range set, else the first and last verse of the page (unchanged)', () => {
    expect(pickerDefaults(hafs, st(), ['1:1', '1:7'])).toEqual({
      start: '1:1',
      end: '1:7',
    });
    expect(pickerDefaults(hafs, st(), [])).toEqual({start: '1:1', end: '1:7'});
    st().setRange({surah: 2, ayah: 255}, {surah: 2, ayah: 257});
    expect(pickerDefaults(hafs, st(), ['1:1'])).toEqual({
      start: '2:255',
      end: '2:257',
    });
  });

  it("Warsh: the page's Warsh verses (the basmala is none of them)", () => {
    expect(
      pickerDefaults(warsh(), st(), [
        '1:1',
        '1:2',
        '1:3',
        '1:4',
        '1:5',
        '1:6',
        '1:7',
      ]),
    ).toEqual({start: '1:1', end: '1:7'});
    expect(pickerDefaults(warsh(), st(), ['103:1', '103:2', '103:3'])).toEqual({
      start: '103:1',
      end: '103:3',
    });
  });

  it('Warsh: a unit range as set, a Hafs range by the Warsh verses holding it', () => {
    st().setUnitRange(fixtureUnit('warsh', '1:7'), fixtureUnit('warsh', '1:7'));
    expect(pickerDefaults(warsh(), st(), ['1:1'])).toEqual({
      start: '1:7',
      end: '1:7',
    });
    st().setRange({surah: 1, ayah: 7}, {surah: 1, ayah: 7});
    expect(pickerDefaults(warsh(), st(), ['1:1'])).toEqual({
      start: '1:6',
      end: '1:7',
    });
  });

  it('a pending start in the numbering of the pickers', () => {
    st().setPendingStart(fixtureUnit('warsh', '1:7'));
    expect(pickerPendingStart(warsh(), st())).toBe('1:7');
    // shown as Hafs keys, a unit is its first Hafs verse
    expect(pickerPendingStart(hafs, st())).toBe('1:7');
    // a Hafs pending start: the Warsh verse holding its start
    useMushafPlayerStore.setState({pendingStartVerseKey: '1:1'});
    expect(pickerPendingStart(warsh(), st())).toBe('1:1');
    useMushafPlayerStore.setState({pendingStartVerseKey: '1:5'});
    expect(pickerPendingStart(warsh(), st())).toBe('1:4');
    st().setPendingStart(null);
    expect(pickerPendingStart(warsh(), st())).toBeNull();
    expect(pickerPendingStart(hafs, st())).toBeNull();
  });
});

describe('selection', () => {
  it('Warsh: the picked verse units', () => {
    const selection = pickerSelection(warsh(), '1:6', '1:7');
    expect(selection).toMatchObject({kind: 'units'});
    if (selection?.kind !== 'units') return;
    expect(selection.first).toBe(fixtureUnit('warsh', '1:6'));
    expect(selection.last).toBe(fixtureUnit('warsh', '1:7'));
    expect(pickerSelection(warsh(), '1:8', '1:8')).toBeNull();
  });

  it('Hafs: the picked Hafs verses, as before', () => {
    expect(pickerSelection(hafs, '2:255', '2:257')).toEqual({
      kind: 'hafs',
      start: {surah: 2, ayah: 255},
      end: {surah: 2, ayah: 257},
    });
    expect(pickerSelection(hafs, 'x', '2:257')).toBeNull();
  });
});
