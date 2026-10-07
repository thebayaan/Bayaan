jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  getLineWordSpans,
  isBlankSlot,
  joinSlotTexts,
  joinWholeWords,
  layoutLineSlots,
  layoutWords,
  spanTokens,
  visibleWords,
  wholeWordLength,
  wholeWordText,
} from '../lineWordSpans';
import {
  digitalKhattDataService,
  type DKLine,
  type DKWordInfo,
} from '../DigitalKhattDataService';
import {
  FIXTURE_DBS,
  expectedSpans,
  findPage,
  fixture,
  pageLines,
  slotText,
  type FixtureDb,
  type FixturePage,
} from '../__fixtures__/rewayahOverlayFixture';

// U+06DD ARABIC END OF AYAH (verse-end marker)
const MARKER = String.fromCharCode(0x06dd);
// Word id of Hafs 37:130:3 (a single slot holding two tokens).
const HAFS_37_130_3 = 61958;

function word(
  text: string,
  verseKey = '1:1',
  wordPositionInVerse = 1,
): DKWordInfo {
  return {text, verseKey, wordPositionInVerse};
}

function lineSource(page: FixturePage, db: FixtureDb) {
  return {
    getWordText: (wordId: number) => slotText(page, db, wordId) ?? '',
    getWordInfo: (wordId: number): DKWordInfo | undefined => {
      const location = page.locations[wordId - page.firstWordId];
      if (location === undefined) return undefined;
      const [s, a, w] = location.split(':');
      return {
        text: slotText(page, db, wordId),
        verseKey: `${s}:${a}`,
        wordPositionInVerse: Number(w),
      };
    },
  };
}

// The real DigitalKhattDataService text joins, called on a minimal `this` so
// the test does not depend on how the service loads its caches.
const serviceProto = Object.getPrototypeOf(digitalKhattDataService) as {
  getLineText(this: unknown, line: DKLine): string;
  getVerseWords(
    this: unknown,
    verseKey: string,
    rewayah?: string,
  ): DKWordInfo[];
  getVerseText(this: unknown, verseKey: string, rewayah?: string): string;
};

function realGetLineText(page: FixturePage, db: FixtureDb, line: DKLine) {
  return serviceProto.getLineText.call(
    {getWordText: (id: number) => slotText(page, db, id) ?? ''},
    line,
  );
}

describe('wholeWordLength / wholeWordText', () => {
  it('keeps plain and multi-token slots whole', () => {
    expect(wholeWordLength('رَبِّ')).toBe('رَبِّ'.length);
    expect(wholeWordLength('إِلْ يَاسِينَ')).toBe('إِلْ يَاسِينَ'.length);
    expect(wholeWordLength('')).toBe(0);
  });

  it('excludes a trailing inline verse marker and its space', () => {
    const slot = `عَلَيْهِمْ ${MARKER}٦`;
    expect(wholeWordText(slot)).toBe('عَلَيْهِمْ');
    expect(wholeWordText(`تَجْرِي مِن ${MARKER}١٠٠`)).toBe('تَجْرِي مِن');
    expect(wholeWordText(`كَلِمَةٌ ${MARKER}۱۲`)).toBe('كَلِمَةٌ');
  });

  it('treats a marker-only slot as having no word part', () => {
    expect(wholeWordLength(`${MARKER}١٣٠`)).toBe(0);
  });

  it('does not strip a marker that is not the last token', () => {
    const slot = `${MARKER}٣ كَلِمَةٌ`;
    expect(wholeWordLength(slot)).toBe(slot.length);
  });
});

describe('layoutLineSlots', () => {
  it('skips blank slots without adding a separator', () => {
    const texts: Record<number, string> = {1: 'أ', 2: '', 3: 'ب ج', 4: ''};
    const {text, spans} = layoutLineSlots(1, 4, id => texts[id]);
    expect(text).toBe('أ ب ج');
    expect(spans.map(s => [s.item, s.start, s.end, s.wordEnd])).toEqual([
      [1, 0, 0, 0],
      [3, 2, 4, 4],
    ]);
  });

  it('returns an empty layout for non-numeric word ids', () => {
    const layout = layoutLineSlots(
      'a' as unknown as number,
      'b' as unknown as number,
      () => 'x',
    );
    expect(layout).toEqual({text: '', spans: []});
  });
});

describe('verse-level helpers', () => {
  const words = [
    word('بِسْمِ'),
    word(''),
    word('إِلْ يَاسِينَ'),
    word(`عَلَيْهِمْ ${MARKER}٦`),
    word(''),
  ];

  it('layoutWords and joinSlotTexts give the same string', () => {
    const layout = layoutWords(words);
    expect(layout.text).toBe(joinSlotTexts(words));
    expect(layout.text).toBe(`بِسْمِ إِلْ يَاسِينَ عَلَيْهِمْ ${MARKER}٦`);
    for (const span of layout.spans) {
      expect(layout.text.slice(span.start, span.end + 1)).toBe(span.item.text);
    }
    const last = layout.spans[2];
    expect(layout.text.slice(last.start, last.wordEnd + 1)).toBe('عَلَيْهِمْ');
  });

  it('joinWholeWords drops blanks and inline verse markers', () => {
    expect(joinWholeWords(words)).toBe('بِسْمِ إِلْ يَاسِينَ عَلَيْهِمْ');
    expect(joinWholeWords([word(`${MARKER}٢`)])).toBe('');
  });

  it('visibleWords is memoized and returns the input when nothing is blank', () => {
    const visible = visibleWords(words);
    expect(visible.map(w => w.text)).toEqual([
      'بِسْمِ',
      'إِلْ يَاسِينَ',
      `عَلَيْهِمْ ${MARKER}٦`,
    ]);
    expect(visibleWords(words)).toBe(visible);
    const noBlanks = [word('a'), word('b')];
    expect(visibleWords(noBlanks)).toBe(noBlanks);
  });

  it('spanTokens gives absolute token offsets', () => {
    expect(spanTokens(`وَأَن لَّوِ ${MARKER}١`, 10)).toEqual([
      {token: 'وَأَن', start: 10},
      {token: 'لَّوِ', start: 16},
      {token: `${MARKER}١`, start: 22},
    ]);
  });

  it('isBlankSlot', () => {
    expect(isBlankSlot('')).toBe(true);
    expect(isBlankSlot(undefined)).toBe(true);
    expect(isBlankSlot(' ')).toBe(false);
  });
});

describe('fixture lines (real words DBs + shared layout)', () => {
  it('covers blank slots, multi-token slots, inline markers, 37:130:3 and page 1', () => {
    const all = (db: FixtureDb, test: (t: string) => boolean) =>
      fixture.pages.some(p => p.texts[db].some(test));
    expect(fixture.pages.some(p => p.page === 1)).toBe(true);
    expect(all('warsh', t => t === '')).toBe(true);
    expect(all('bazzi', t => t === '')).toBe(true);
    expect(all('soosi', t => t.includes(` ${MARKER}`))).toBe(true);
    // 9:100:17: two Ibn Kathir words in one Hafs slot
    expect(
      findPage(203).texts.bazzi.some(
        t => t.includes(' ') && !t.includes(MARKER),
      ),
    ).toBe(true);
    // 37:130:3 is a two-token slot in the Hafs DB itself (and Shu'bah)
    const p451 = findPage(451);
    expect(slotText(p451, 'hafs', HAFS_37_130_3).split(' ')).toHaveLength(2);
    expect(slotText(p451, 'shouba', HAFS_37_130_3)).toBe(
      slotText(p451, 'hafs', HAFS_37_130_3),
    );
  });

  for (const db of FIXTURE_DBS) {
    it(`${db}: spans index exactly into the getLineText string`, () => {
      let checkedLines = 0;
      for (const page of fixture.pages) {
        const lines = pageLines(page);
        for (const expectedLine of page.expected[db]) {
          const line = lines[expectedLine.lineIndex];
          const text = realGetLineText(page, db, line);
          expect(text.length).toBe(expectedLine.textLength);

          const spans = getLineWordSpans(line, lineSource(page, db));
          expect(
            spans.map(s => ({
              wordId: s.wordId,
              start: s.start,
              end: s.end,
              wordEnd: s.wordEnd,
            })),
          ).toEqual(expectedSpans(page, db, expectedLine));

          let cursor = 0;
          for (const [i, span] of spans.entries()) {
            const slot = slotText(page, db, span.wordId);
            expect(span.text).toBe(slot);
            expect(text.slice(span.start, span.end + 1)).toBe(slot);
            expect(text.slice(span.start, span.wordEnd + 1)).toBe(
              wholeWordText(slot),
            );
            // exactly one separator between consecutive spans, none at the ends
            expect(span.start).toBe(i === 0 ? 0 : cursor + 1);
            if (i > 0) expect(text[span.start - 1]).toBe(' ');
            cursor = span.end + 1;
          }
          expect(cursor).toBe(text.length);
          checkedLines++;
        }
      }
      expect(checkedLines).toBeGreaterThan(100);
    });
  }

  it('Hafs page 451 line 2 keeps 37:130:3 as one span (no Hafs regression)', () => {
    const page = findPage(451);
    const line = pageLines(page)[1];
    const spans = getLineWordSpans(line, lineSource(page, 'hafs'));
    const slot = spans.find(s => s.wordId === HAFS_37_130_3)!;
    const text = realGetLineText(page, 'hafs', line);
    expect(text.slice(slot.start, slot.end + 1)).toBe(
      slotText(page, 'hafs', HAFS_37_130_3),
    );
    // the slot is one span covering both tokens; every other Hafs slot on the
    // line is a single token
    expect(slot.text.split(' ')).toHaveLength(2);
    expect(spans.filter(s => s.text.includes(' ')).map(s => s.wordId)).toEqual([
      HAFS_37_130_3,
    ]);
  });

  it('non-ayah lines have no spans', () => {
    const page = findPage(2);
    const lines = pageLines(page);
    expect(lines[0].line_type).toBe('surah_name');
    expect(lines[1].line_type).toBe('basmallah');
    expect(getLineWordSpans(lines[0], lineSource(page, 'warsh'))).toEqual([]);
    expect(getLineWordSpans(lines[1], lineSource(page, 'warsh'))).toEqual([]);
  });
});

describe('DigitalKhattDataService verse joins', () => {
  const page = findPage(1);
  const slots = (db: FixtureDb, verseKey: string): DKWordInfo[] =>
    page.locations
      .map((location, i) => ({location, text: page.texts[db][i]}))
      .filter(({location}) => location.startsWith(`${verseKey}:`))
      .map(({location, text}) => ({
        text,
        verseKey,
        wordPositionInVerse: Number(location.split(':')[2]),
      }));

  const fakeThis = (db: FixtureDb) => {
    const verseWords = new Map([
      ['1:1', slots(db, '1:1')],
      ['1:7', slots(db, '1:7')],
    ]);
    return {
      currentRewayah: 'warsh',
      verseWords,
      sideVerseWords: new Map([['al-bazzi', verseWords]]),
      getVerseWords(verseKey: string, rewayah?: string) {
        return serviceProto.getVerseWords.call(this, verseKey, rewayah);
      },
    };
  };

  it('getVerseWords omits blank slots and keeps Hafs positions', () => {
    const ctx = fakeThis('warsh');
    const words = serviceProto.getVerseWords.call(ctx, '1:1');
    expect(slots('warsh', '1:1').some(w => w.text === '')).toBe(true);
    expect(words.every(w => w.text !== '')).toBe(true);
    expect(words.map(w => w.wordPositionInVerse)).toEqual([1, 2, 3, 4]);
    // side cache path
    expect(serviceProto.getVerseWords.call(ctx, '1:1', 'al-bazzi')).toEqual(
      words,
    );
    expect(serviceProto.getVerseWords.call(ctx, '9:9')).toEqual([]);
  });

  it('getVerseText joins with single spaces and keeps the inline marker', () => {
    const ctx = fakeThis('warsh');
    const text = serviceProto.getVerseText.call(ctx, '1:7');
    expect(text).not.toMatch(/ {2}|^ | $/);
    expect(text).toContain(`${MARKER}٦`);
    expect(text).toBe(joinSlotTexts(slots('warsh', '1:7')));
    const words = serviceProto.getVerseWords.call(ctx, '1:7');
    expect(layoutWords(words).text).toBe(text);
  });
});
