const mockDk = {
  ready: true,
  words: {} as Record<string, {text: string}[]>,
};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    isRewayahReady: () => mockDk.ready,
    tryGetVerseWords: (key: string) => mockDk.words[key] ?? null,
  },
}));

import {buildIdenticalAyatIndex} from '../identicalAyat';

type Module = typeof import('../identicalAyat');

describe('buildIdenticalAyatIndex', () => {
  it('groups ayat with exactly the same wording, in mushaf order', () => {
    const wording: Record<string, string> = {
      '55:13': 'A',
      '55:14': 'B',
      '55:16': 'A',
      '55:18': 'A',
      '77:15': 'C',
      '77:19': 'C',
      '77:20': 'C ',
    };
    const index = buildIdenticalAyatIndex(
      Object.keys(wording),
      key => wording[key] ?? null,
    );
    expect(index.get('55:13')).toEqual(['55:16', '55:18']);
    expect(index.get('55:16')).toEqual(['55:13', '55:18']);
    expect(index.get('77:19')).toEqual(['77:15']);
    expect(index.has('55:14')).toBe(false);
    expect(index.has('77:20')).toBe(false);
  });

  it('skips ayat whose wording is unknown', () => {
    const index = buildIdenticalAyatIndex(['1:1', '1:2'], () => null);
    expect(index.size).toBe(0);
  });
});

describe('identicalAyatOf', () => {
  let identicalAyatOf: Module['identicalAyatOf'];

  beforeEach(() => {
    mockDk.ready = true;
    mockDk.words = {};
    jest.isolateModules(() => {
      identicalAyatOf = require('../identicalAyat').identicalAyatOf;
    });
  });

  it('compares the Hafs words without the ayah markers', () => {
    mockDk.words = {
      '55:13': [{text: 'فَبِأَيِّ'}, {text: 'رَبِّكُمَا'}, {text: '۝١٣'}],
      '55:16': [{text: 'فَبِأَيِّ'}, {text: 'رَبِّكُمَا'}, {text: '۝١٦'}],
      '55:17': [{text: 'رَبُّ'}, {text: '۝١٧'}],
    };
    expect(identicalAyatOf('55:13')).toEqual(['55:16']);
    expect(identicalAyatOf('55:17')).toEqual([]);
  });

  it('answers nothing until the Hafs text is loaded, then builds the index', () => {
    mockDk.ready = false;
    mockDk.words = {
      '55:13': [{text: 'x'}],
      '55:16': [{text: 'x'}],
    };
    expect(identicalAyatOf('55:13')).toEqual([]);
    mockDk.ready = true;
    expect(identicalAyatOf('55:13')).toEqual(['55:16']);
  });
});
