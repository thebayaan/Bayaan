// @ai-generated
/**
 * Share card: the basmala under each surah header is the basmala of the
 * card's rewayah as it opens that surah (contract C6); Hafs (and a card
 * without a rewayah) keeps BASMALLAH_TEXT.
 */

interface FakeParagraph {
  text: string;
  layout: () => void;
  getHeight: () => number;
  getLongestLine: () => number;
}

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Color: (c: string) => c,
    ParagraphBuilder: {
      Make: () => {
        let text = '';
        return {
          pushStyle: () => undefined,
          pop: () => undefined,
          addText: (t: string) => {
            text += t;
          },
          build: (): FakeParagraph => ({
            text,
            layout: () => undefined,
            getHeight: () => 10,
            getLongestLine: () => 10,
          }),
        };
      },
    },
  },
  TextDirection: {RTL: 0},
  TextAlign: {Center: 0, Left: 1},
}));

import {buildShareCardParagraphs} from '../buildShareCardParagraphs';
import {BASMALLAH_TEXT} from '@/services/mushaf/RewayahBasmalaService';
import {EXPECTED_BASMALA} from '@/services/mushaf/__fixtures__/basmalaTexts';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

function basmalas(
  verseKeys: string[],
  rewayah: RewayahId | undefined,
  showBasmallah = true,
): (string | null)[] {
  const elements = buildShareCardParagraphs(
    verseKeys,
    verseKeys.map(() => 'نص'),
    300,
    {} as SkTypefaceFontProvider,
    false,
    false,
    null,
    'DigitalKhattV2',
    showBasmallah,
    rewayah,
  );
  return elements.sections.map(
    s =>
      (s.basmallahParagraph as unknown as FakeParagraph | null)?.text ?? null,
  );
}

describe('share card basmala', () => {
  it('Hafs, or no rewayah: BASMALLAH_TEXT', () => {
    expect(basmalas(['2:1'], 'hafs')).toEqual([BASMALLAH_TEXT]);
    expect(basmalas(['2:1'], undefined)).toEqual([BASMALLAH_TEXT]);
  });

  it("a rewayah card: that rewayah's basmala, in each surah's own spelling", () => {
    const susi = EXPECTED_BASMALA['al-susi']!;
    expect(basmalas(['13:43', '14:1', '15:1'], 'al-susi')).toEqual([
      susi.dk,
      susi.bySurah[14].dk,
      susi.bySurah[15].dk,
    ]);
    expect(basmalas(['2:1'], 'warsh')).toEqual([EXPECTED_BASMALA.warsh!.dk]);
  });

  it('no basmala for the Fatiha, at-Tawbah, when turned off, or without data', () => {
    expect(basmalas(['1:2', '9:1'], 'qalun')).toEqual([null, null]);
    expect(basmalas(['2:1'], 'qalun', false)).toEqual([null]);
    expect(basmalas(['2:1'], 'hisham')).toEqual([null]);
  });
});
