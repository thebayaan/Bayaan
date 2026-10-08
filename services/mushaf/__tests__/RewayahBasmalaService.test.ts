// @ai-generated
/**
 * RewayahBasmalaService (contract C6): the bundled <file id>-basmala.json
 * files hold the signed KFGQPC Word-file basmala of each rewayah, and every
 * surah-opening basmala a rewayah draws comes from them, never the Hafs text.
 */
import {
  BASMALA_FILE_IDS,
  BASMALLAH_TEXT,
  basmalaLineSurahs,
  isBasmalaText,
  layoutLineKey,
  parseBasmala,
  RewayahBasmalaService,
  rewayahBasmalaService,
  type BasmalaFileId,
  type BasmalaLayoutRow,
  type RewayahBasmalaJson,
} from '../RewayahBasmalaService';
import {
  BASMALA_REWAYAT,
  EXPECTED_BASMALA,
  expectedDrawnBasmala,
} from '../__fixtures__/basmalaTexts';
import {
  ALL_REWAYAH_IDS,
  hasTextData,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

const SURAHS_WITH_BASMALA_LINE = Array.from(
  {length: 113},
  (_, i) => i + 2,
).filter(s => s !== 9);

function bundled(fileId: BasmalaFileId): RewayahBasmalaJson {
  return require(`@/data/mushaf/digitalkhatt/${fileId}-basmala.json`);
}

function loadersReturning(
  docs: Partial<Record<BasmalaFileId, unknown>>,
): Record<BasmalaFileId, () => unknown> {
  const out = {} as Record<BasmalaFileId, () => unknown>;
  for (const fileId of Object.values(BASMALA_FILE_IDS) as BasmalaFileId[]) {
    out[fileId] = () => (fileId in docs ? docs[fileId] : bundled(fileId));
  }
  return out;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('bundled basmala files', () => {
  it('cover exactly the rewayat with DigitalKhatt text other than Hafs', () => {
    const withText = ALL_REWAYAH_IDS.filter(
      r => hasTextData(r) && r !== 'hafs',
    );
    expect(Object.keys(BASMALA_FILE_IDS).sort()).toEqual([...withText].sort());
    expect([...BASMALA_REWAYAT].sort()).toEqual([...withText].sort());
  });

  it.each(BASMALA_REWAYAT)(
    '%s: the verbatim Word-file text, its DigitalKhatt form and provenance',
    rewayah => {
      const expected = EXPECTED_BASMALA[rewayah]!;
      const fileId = BASMALA_FILE_IDS[rewayah]!;
      expect(fileId).toBe(expected.fileId);
      const doc = bundled(fileId);
      expect(() => parseBasmala(doc, rewayah, fileId)).not.toThrow();
      expect(doc.__format).toBe(1);
      expect(doc.rewayah).toBe(rewayah);
      expect(doc.official).toBe(expected.official);
      expect(doc.dk).toBe(expected.dk);
      expect(doc.source.file).toMatch(/\.docx$/);
      expect(expected.sourceSha256).toContain(doc.source.sha256);
      // Every surah the file lists is one the Word file writes differently,
      // with the verbatim text and the drawn text expected for it...
      const listed = Object.keys(doc.bySurah ?? {}).map(Number);
      for (const surah of listed) {
        expect([surah, doc.bySurah![String(surah)]]).toEqual([
          surah,
          expected.bySurah[surah],
        ]);
      }
      // ...and no surah drawn differently is missing.
      for (const surah of expected.drawnOverrides) {
        expect(listed).toContain(surah);
      }
    },
  );

  it('no file holds the Hafs basmala of the DigitalKhatt Hafs mushaf', () => {
    for (const rewayah of BASMALA_REWAYAT) {
      const doc = bundled(BASMALA_FILE_IDS[rewayah]!);
      expect(doc.dk).not.toBe(BASMALLAH_TEXT);
      expect(doc.official).not.toBe(BASMALLAH_TEXT);
    }
  });
});

describe('getText', () => {
  const service = new RewayahBasmalaService();

  it('Hafs: BASMALLAH_TEXT for every surah, unchanged', () => {
    expect(BASMALLAH_TEXT).toBe(
      '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u064E\u0651\u0647\u0650 ' +
        '\u0671\u0644\u0631\u064E\u0651\u062D\u0652\u0645\u064E\u0670\u0646\u0650 ' +
        '\u0671\u0644\u0631\u064E\u0651\u062D\u0650\u064A\u0645\u0650',
    );
    expect(service.getText('hafs')).toBe(BASMALLAH_TEXT);
    for (const surah of SURAHS_WITH_BASMALA_LINE) {
      expect(service.getText('hafs', surah)).toBe(BASMALLAH_TEXT);
    }
    expect(service.getDataVersion('hafs')).toBeNull();
  });

  it.each(BASMALA_REWAYAT)(
    "%s: its own basmala at the head of every surah, in the surah's own spelling",
    rewayah => {
      for (const surah of SURAHS_WITH_BASMALA_LINE) {
        expect([surah, service.getText(rewayah, surah)]).toEqual([
          surah,
          expectedDrawnBasmala(rewayah, surah),
        ]);
      }
      expect(service.getText(rewayah)).toBe(EXPECTED_BASMALA[rewayah]!.dk);
      expect(service.getText(rewayah, null)).toBe(
        EXPECTED_BASMALA[rewayah]!.dk,
      );
    },
  );

  it("al-Susi 14 and 15 take the previous surah's last ba (idgham kabir)", () => {
    expect(
      service.getText('al-susi', 14).startsWith('\u0628\u0651\u0650'),
    ).toBe(true);
    expect(
      service.getText('al-susi', 15).startsWith('\u0628\u0651\u0650'),
    ).toBe(true);
    expect(service.getText('al-duri-abi-amr', 14)).toBe(
      service.getText('al-duri-abi-amr'),
    );
  });

  it('rewayat without basmala data draw nothing, never the Hafs basmala', () => {
    const taxonomyOnly = ALL_REWAYAH_IDS.filter(r => !hasTextData(r));
    expect(taxonomyOnly.length).toBeGreaterThan(0);
    for (const rewayah of taxonomyOnly) {
      expect(service.getText(rewayah, 2)).toBe('');
      expect(service.getDataVersion(rewayah)).toBeNull();
    }
  });
});

describe('validation (a malformed file never puts other text on the line)', () => {
  const warsh = () =>
    clone(bundled('warsh')) as unknown as Record<string, unknown>;
  const cases: [string, (doc: Record<string, unknown>) => unknown][] = [
    ['not an object', () => 'بسم'],
    ['an array', () => []],
    ['another format', doc => ({...doc, __format: 2})],
    ['another rewayah', doc => ({...doc, rewayah: 'qalun'})],
    ['a missing dk', doc => ({...doc, dk: undefined})],
    [
      'a changed letter',
      doc => ({...doc, dk: (doc.dk as string).replace('\u0633', '\u0634')}),
    ],
    ['a fifth word', doc => ({...doc, dk: `${doc.dk as string} \u0628`})],
    [
      'a double space',
      doc => ({...doc, dk: (doc.dk as string).replace(' ', '  ')}),
    ],
    [
      'a trailing space',
      doc => ({...doc, official: `${doc.official as string} `}),
    ],
    ['no source', doc => ({...doc, source: undefined})],
    [
      'a bad sha256',
      doc => ({...doc, source: {file: 'x.docx', sha256: 'abc'}}),
    ],
    ['bySurah not an object', doc => ({...doc, bySurah: []})],
    [
      'a bySurah key out of range',
      doc => ({...doc, bySurah: {115: {official: doc.official, dk: doc.dk}}}),
    ],
    [
      'a non-canonical bySurah key',
      doc => ({...doc, bySurah: {'014': {official: doc.official, dk: doc.dk}}}),
    ],
    [
      'a bySurah entry that is not a basmala',
      doc => ({
        ...doc,
        bySurah: {14: {official: doc.official, dk: 'الحمد لله'}},
      }),
    ],
  ];

  it.each(cases)('rejects %s', (_label, mutate) => {
    expect(() => parseBasmala(mutate(warsh()), 'warsh', 'warsh')).toThrow();
  });

  it('fails closed: the rewayah draws no basmala, logged once', () => {
    const service = new RewayahBasmalaService(
      loadersReturning({warsh: {...warsh(), __format: 9}}),
    );
    expect(service.getText('warsh', 2)).toBe('');
    expect(service.getText('warsh', 75)).toBe('');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // Other rewayat are unaffected.
    expect(service.getText('qalun', 2)).toBe(EXPECTED_BASMALA.qalun!.dk);
  });

  it('accepts a file without bySurah', () => {
    const doc = warsh();
    delete doc.bySurah;
    const service = new RewayahBasmalaService(loadersReturning({warsh: doc}));
    expect(service.getText('warsh', 75)).toBe(EXPECTED_BASMALA.warsh!.dk);
  });
});

describe('isBasmalaText', () => {
  it('requires the four basmala words with single spaces; marks may differ', () => {
    expect(isBasmalaText(BASMALLAH_TEXT)).toBe(true);
    expect(isBasmalaText(EXPECTED_BASMALA.warsh!.official)).toBe(true);
    expect(isBasmalaText(EXPECTED_BASMALA['al-susi']!.bySurah[14].dk)).toBe(
      true,
    );
    expect(isBasmalaText('بسم الله الرحمن الرحيم')).toBe(true);
    expect(isBasmalaText('بسم الله الرحمن')).toBe(false);
    expect(isBasmalaText('بسم الله الرحمن الرحيم ')).toBe(false);
    expect(isBasmalaText('بسم\u00A0الله الرحمن الرحيم')).toBe(false);
    expect(isBasmalaText('باسم الله الرحمن الرحيم')).toBe(false);
    expect(isBasmalaText(null)).toBe(false);
  });
});

describe('getDataVersion (contract C5: changes exactly when the drawn text changes)', () => {
  it('is 8 hex digits, stable, and distinct per drawn text', () => {
    const versions = new Map<string, RewayahId[]>();
    for (const rewayah of BASMALA_REWAYAT) {
      const version = rewayahBasmalaService.getDataVersion(rewayah)!;
      expect(version).toMatch(/^[0-9a-f]{8}$/);
      expect(rewayahBasmalaService.getDataVersion(rewayah)).toBe(version);
      versions.set(version, [...(versions.get(version) ?? []), rewayah]);
    }
    // Same drawn texts -> same version: al-Bazzi and Qunbul write the same
    // basmala everywhere, and so do Shu'bah; nothing else coincides.
    const groups = [...versions.values()].map(g => [...g].sort());
    expect(groups).toEqual(
      expect.arrayContaining([['al-bazzi', 'qunbul', 'shubah']]),
    );
    expect(groups).toHaveLength(BASMALA_REWAYAT.length - 2);
  });

  it('ignores what is not drawn (official text, provenance)', () => {
    const doc = clone(bundled('warsh')) as unknown as RewayahBasmalaJson;
    doc.source = {file: 'other.docx', sha256: 'f'.repeat(64)};
    delete doc.bySurah; // the 75/83/90/104 entries draw the default text
    const service = new RewayahBasmalaService(loadersReturning({warsh: doc}));
    expect(service.getDataVersion('warsh')).toBe(
      rewayahBasmalaService.getDataVersion('warsh'),
    );
  });

  it('changes when a drawn text changes, and for a rejected file', () => {
    const doc = clone(bundled('soosi')) as unknown as RewayahBasmalaJson;
    delete doc.bySurah!['15'];
    const changed = new RewayahBasmalaService(loadersReturning({soosi: doc}));
    expect(changed.getDataVersion('al-susi')).not.toBe(
      rewayahBasmalaService.getDataVersion('al-susi'),
    );
    const rejected = new RewayahBasmalaService(
      loadersReturning({soosi: {...doc, rewayah: 'warsh'}}),
    );
    const version = rejected.getDataVersion('al-susi');
    expect(version).toMatch(/^[0-9a-f]{8}$/);
    expect(version).not.toBe(rewayahBasmalaService.getDataVersion('al-susi'));
    expect(rejected.getText('al-susi', 2)).toBe('');
  });
});

describe('basmalaLineSurahs', () => {
  const row = (
    page: number,
    line: number,
    type: string,
    surah: number | null = null,
  ): BasmalaLayoutRow => ({
    page_number: page,
    line_number: line,
    line_type: type,
    surah_number: surah,
  });

  it('gives each basmallah line the surah of the header right before it', () => {
    const surahs = basmalaLineSurahs([
      row(1, 1, 'surah_name', 1),
      row(1, 2, 'ayah'),
      row(2, 1, 'surah_name', 2),
      row(2, 2, 'basmallah'),
      row(2, 3, 'ayah'),
      row(76, 15, 'surah_name', 4), // header closes the page
      row(77, 1, 'basmallah'),
      row(80, 3, 'surah_name', 5),
      row(80, 4, 'ayah'),
      row(80, 5, 'basmallah'), // not right after a header
      row(90, 1, 'surah_name', 0), // invalid surah number
      row(90, 2, 'basmallah'),
    ]);
    expect([...surahs]).toEqual([
      [layoutLineKey(2, 2), 2],
      [layoutLineKey(77, 1), 4],
    ]);
  });
});
