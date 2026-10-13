jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {resetDatabases} from '@/test-utils/mockExpoSqlite';

type Service = typeof import('../TranslationDbService').translationDbService;

function freshService(): Service {
  let service: Service | undefined;
  jest.isolateModules(() => {
    service = require('../TranslationDbService').translationDbService;
  });
  if (!service) throw new Error('service not loaded');
  return service;
}

function verse(verseKey: string, text: string) {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {verseKey, surahNumber: surah, ayahNumber: ayah, text};
}

beforeEach(async () => {
  await resetDatabases();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TranslationDbService footnotes', () => {
  it('saves footnotes with the verses and reads them per edition', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTranslation(
      '20',
      'Saheeh International',
      'Saheeh International',
      'English',
      'ltr',
      [verse('1:1', 'a<sup foot_note=1>1</sup>')],
      [
        {id: '1', text: '<p>one</p>'},
        {id: '2', text: 'two'},
      ],
    );
    await svc.saveTranslation('en.x', 'X', 'X', 'en', 'ltr', [
      verse('1:1', 'x'),
    ]);
    expect(await svc.getFootnotes('20')).toEqual({
      '1': '<p>one</p>',
      '2': 'two',
    });
    expect(await svc.getFootnote('20', '2')).toBe('two');
    expect(await svc.getFootnote('20', '3')).toBeNull();
    expect(await svc.getFootnotes('en.x')).toEqual({});
  });

  it('a re-save replaces the old footnotes', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTranslation(
      '20',
      'n',
      'n',
      'English',
      'ltr',
      [verse('1:1', 'old')],
      [{id: '1', text: 'old note'}],
    );
    await svc.saveTranslation(
      '20',
      'n',
      'n',
      'English',
      'ltr',
      [verse('1:1', 'new')],
      [{id: '9', text: 'new note'}],
    );
    expect(await svc.getFootnotes('20')).toEqual({'9': 'new note'});
    expect(await svc.getTranslation('1:1', '20')).toBe('new');
  });

  it('a failed save leaves the installed verses and footnotes intact', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTranslation(
      '20',
      'n',
      'n',
      'English',
      'ltr',
      [verse('1:1', 'old')],
      [{id: '1', text: 'old note'}],
    );
    // A duplicate footnote id violates the primary key mid-transaction.
    await expect(
      svc.saveTranslation(
        '20',
        'n',
        'n',
        'English',
        'ltr',
        [verse('1:1', 'new')],
        [
          {id: '5', text: 'a'},
          {id: '5', text: 'b'},
        ],
      ),
    ).rejects.toThrow();
    expect(await svc.getTranslation('1:1', '20')).toBe('old');
    expect(await svc.getFootnotes('20')).toEqual({'1': 'old note'});
    expect(await svc.isDownloaded('20')).toBe(true);
  });

  it('delete removes the footnotes too', async () => {
    const svc = freshService();
    await svc.initialize();
    await svc.saveTranslation(
      '20',
      'n',
      'n',
      'English',
      'ltr',
      [verse('1:1', 'a')],
      [{id: '1', text: 'note'}],
    );
    await svc.deleteTranslation('20');
    expect(await svc.getFootnotes('20')).toEqual({});
    expect(await svc.isDownloaded('20')).toBe(false);
  });
});
