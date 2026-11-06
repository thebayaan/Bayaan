import type {
  DownloadedTranslationMeta,
  RemoteTranslationEdition,
} from '@/types/translation';
import type {AppLanguage} from '@/i18n/languages';

// translationInstaller (for language names) imports the store and its
// services; keep them inert.
jest.mock('@/services/content/contentSync', () => ({}));
jest.mock('@/services/translation/TranslationApiService', () => ({}));
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {},
}));
jest.mock('@/i18n/language', () => ({currentLanguage: 'en'}));

import {
  buildTranslationPicker,
  matchesTranslationQuery,
  offeredFromManifest,
  offeredFromProvider,
  type OfferedEdition,
} from '../translationPicker';

function downloaded(
  identifier: string,
  englishName: string,
  language = 'english',
): DownloadedTranslationMeta {
  return {
    identifier,
    name: englishName,
    englishName,
    language,
    direction: 'ltr',
    downloadedAt: 1,
    verseCount: 6236,
  };
}

const OFFERED: OfferedEdition[] = [
  {
    id: '20',
    name: 'Saheeh International',
    author: 'Saheeh International',
    language: 'English',
    bytes: 1_500_000,
  },
  {
    id: '19',
    name: 'Pickthall',
    author: 'M. Pickthall',
    language: 'English',
    bytes: 1_400_000,
  },
  {
    id: '31',
    name: 'Hamidullah',
    author: 'Muhammad Hamidullah',
    language: 'French',
    bytes: 1_600_000,
  },
  {
    id: '97',
    name: 'Tafheem-ul-Quran',
    author: 'Abul Ala Maududi',
    language: 'Urdu',
    bytes: 2_000_000,
  },
  {
    id: '45',
    name: 'Kuliev',
    author: 'Elmir Kuliev',
    language: 'Russian',
    bytes: 1_700_000,
  },
  {
    id: '78',
    name: 'Abu Adel',
    author: 'Abu Adel',
    language: 'Arabic',
    bytes: null,
  },
];

function picker(
  overrides: Partial<Parameters<typeof buildTranslationPicker>[0]> = {},
) {
  return buildTranslationPicker({
    downloaded: [],
    offered: OFFERED,
    selectedId: 'clear-quran',
    renderedId: 'clear-quran',
    query: '',
    uiLanguage: 'en',
    formatSize: bytes => `${bytes / 1_000_000} MB`,
    ...overrides,
  });
}

describe('offered editions', () => {
  it('maps manifest meta to picker editions with display languages', () => {
    expect(
      offeredFromManifest([
        {
          key: 'qf:translations:31',
          id: '31',
          meta: {
            name: 'Hamidullah',
            author: 'Muhammad Hamidullah',
            language: 'french',
          },
          bytes: 1000,
        },
        {
          key: 'qf:translations:99',
          id: '99',
          meta: undefined,
          bytes: undefined,
        },
      ]),
    ).toEqual([
      {
        id: '31',
        name: 'Hamidullah',
        author: 'Muhammad Hamidullah',
        language: 'French',
        bytes: 1000,
      },
      {
        id: '99',
        name: 'Translation 99',
        author: null,
        language: 'Other',
        bytes: null,
      },
    ]);
  });

  it('maps a fork provider edition list (RFC-009)', () => {
    const edition: RemoteTranslationEdition = {
      identifier: 'en.custom',
      language: 'en',
      name: 'Custom',
      englishName: 'Custom',
      format: 'text',
      type: 'translation',
      direction: 'ltr',
    };
    expect(offeredFromProvider([edition])).toEqual([
      {
        id: 'en.custom',
        name: 'Custom',
        author: null,
        language: 'English',
        bytes: null,
      },
    ]);
  });
});

describe('buildTranslationPicker', () => {
  it('lists installed editions first, then the catalog grouped by language', () => {
    const result = picker({
      downloaded: [downloaded('20', 'Saheeh International')],
    });
    expect(result.installed.map(row => row.id)).toEqual(['20']);
    expect(result.groups[0].rows.map(row => row.id)).toEqual(['19']);
    expect(result.needsCatalog).toBe(false);
  });

  it.each<[AppLanguage, string[], string[]]>([
    [
      'en',
      ['English', 'Arabic', 'French', 'Russian', 'Urdu'],
      ['English', 'Arabic', 'French', 'Russian', 'Urdu'],
    ],
    [
      'ar',
      // Arabic alphabetical order: الأردية before الإنجليزية.
      ['Arabic', 'Urdu', 'English', 'Russian', 'French'],
      ['العربية', 'الأردية', 'الإنجليزية', 'الروسية', 'الفرنسية'],
    ],
  ])(
    'in a %s UI, puts its language first, then sorts by localized name',
    (uiLanguage, languages, titles) => {
      const result = picker({uiLanguage});
      expect(result.groups.map(group => group.language)).toEqual(languages);
      expect(result.groups.map(group => group.title)).toEqual(titles);
    },
  );

  it('labels rows with a title and an author · size subtitle', () => {
    const result = picker({
      downloaded: [downloaded('19', 'Pickthall (old)', 'en')],
      selectedId: '20',
    });
    // Downloaded: named from the manifest, no size.
    expect(result.installed.find(row => row.id === '19')).toMatchObject({
      title: 'Pickthall',
      subtitle: 'M. Pickthall',
      language: 'English',
    });
    const offered = result.groups.flatMap(group => group.rows);
    expect(offered.find(row => row.id === '31')).toMatchObject({
      title: 'Hamidullah',
      subtitle: 'Muhammad Hamidullah · 1.6 MB',
    });
    // An author equal to the title, and no size, adds nothing.
    expect(offered.find(row => row.id === '78')?.subtitle).toBeNull();
    expect(offered.find(row => row.id === '20')?.subtitle).toBe(
      'Saheeh International · 1.5 MB',
    );
  });

  it('leaves the active edition out of the installed list and keeps Clear Quran in it', () => {
    const result = picker({
      downloaded: [downloaded('20', 'Saheeh International')],
      selectedId: '20',
    });
    expect(result.installed.map(row => row.id)).toEqual(['clear-quran']);
    expect(result.installed[0]).toMatchObject({
      isBundled: true,
      subtitle: 'Dr. Mustafa Khattab',
    });
  });

  it('searches name, author and language', () => {
    const ids = (query: string) => {
      const result = picker({selectedId: '20', query});
      return [
        ...result.installed,
        ...result.groups.flatMap(group => group.rows),
      ].map(row => row.id);
    };
    expect(ids('pick')).toEqual(['19']);
    // A selected edition that is not downloaded yet (the queued Saheeh
    // install) stays downloadable.
    expect(ids('saheeh')).toEqual(['20']);
    expect(ids('maududi')).toEqual(['97']);
    expect(ids('  FRENCH ')).toEqual(['31']);
    expect(ids('khattab')).toEqual(['clear-quran']);
    expect(ids('nothing like this')).toEqual([]);
  });

  it('before any catalog: installed editions and Clear Quran, plus the connect row', () => {
    const result = picker({
      downloaded: [downloaded('20', 'Saheeh International')],
      offered: null,
      selectedId: '20',
    });
    expect(result.installed.map(row => row.id)).toEqual(['clear-quran']);
    expect(result.groups).toEqual([]);
    expect(result.needsCatalog).toBe(true);
  });

  it('matchesTranslationQuery matches everything on an empty query', () => {
    expect(
      matchesTranslationQuery({name: 'A', author: null, language: 'B'}, ' '),
    ).toBe(true);
  });

  describe('the active edition', () => {
    it('names the bundled fallback the reader shows for an offline Saheeh upgrade', () => {
      // "saheeh" was remapped to "20"; no manifest yet and 20 not downloaded,
      // so the reader renders Clear Quran.
      const result = picker({
        offered: null,
        selectedId: '20',
        renderedId: 'clear-quran',
      });
      expect(result.active).toEqual({
        id: 'clear-quran',
        name: 'The Clear Quran',
        language: 'English',
      });
    });

    it('names a downloaded selection from the catalog, in the UI language', () => {
      const result = picker({
        downloaded: [downloaded('97', 'Maududi (old)', 'urdu')],
        selectedId: '97',
        // Its text has not loaded yet; it renders once it does.
        renderedId: 'clear-quran',
        uiLanguage: 'ar',
      });
      expect(result.active).toEqual({
        id: '97',
        name: 'Tafheem-ul-Quran',
        language: 'الأردية',
      });
    });

    it('names a downloaded selection the catalog does not list from its copy', () => {
      const result = picker({
        downloaded: [downloaded('131', 'Dr. Mustafa', 'xx')],
        offered: null,
        selectedId: '131',
        renderedId: '131',
      });
      expect(result.active).toEqual({
        id: '131',
        name: 'Dr. Mustafa',
        language: '',
      });
    });
  });
});
