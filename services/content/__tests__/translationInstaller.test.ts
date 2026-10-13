jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
// translationStore imports contentSync (the picker installs through it);
// keep this suite on the installer alone.
jest.mock('@/services/content/contentSync', () => ({
  installContent: jest.fn(),
  removeContent: jest.fn(),
  getOfferedTranslations: jest.fn(),
  isEngineInstallingTranslations: () => false,
}));

import {SURAHS} from '@/data/surahData';
import type {ContentEnvelope} from '@/types/content';
import {
  createTranslationInstaller,
  translationIdFromKey,
  translationLanguageName,
} from '../translationInstaller';

const KEY = 'qf:translations:20';

function fullRecords(): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      records.push({verse_key: `${surah.id}:${ayah}`, text: `t`});
    }
  }
  records[0] = {
    verse_key: '1:1',
    text: 'In the name<sup foot_note=254011>1</sup>',
    foot_notes: [{id: 254011, text: '<p>Note</p>'}],
  };
  return records;
}

function makeEnvelope(
  records: Array<Record<string, unknown>>,
): ContentEnvelope {
  return {
    envelope: 1,
    key: KEY,
    version: 2,
    source: 'qf',
    fetched_at: 'x',
    snapshot: {
      resource_group: 'translations',
      resource_id: 20,
      schema_version: 1,
      records,
    },
  };
}

const envelope = makeEnvelope(fullRecords());

function makeDb(
  downloaded: Array<{
    identifier: string;
    name: string;
    englishName: string;
    language: string;
    direction: 'ltr' | 'rtl';
  }> = [],
) {
  return {
    saveTranslation: jest.fn().mockResolvedValue(undefined),
    deleteTranslation: jest.fn().mockResolvedValue(undefined),
    getDownloadedTranslations: jest.fn().mockResolvedValue(downloaded),
  };
}

function makeStore() {
  const state = {loadDownloadedMeta: jest.fn().mockResolvedValue(undefined)};
  return {getState: () => state, state};
}

function makeSettings(selected: string) {
  const state = {
    selectedTranslationId: selected,
    setSelectedTranslationId: jest.fn((id: string) => {
      state.selectedTranslationId = id;
    }),
  };
  return {getState: () => state, state};
}

describe('translation installer', () => {
  it('maps keys to bare QF ids', () => {
    expect(translationIdFromKey(KEY)).toBe('20');
  });

  it('maps QF language names to display names and keeps unknown ones raw', () => {
    expect(translationLanguageName('english')).toBe('English');
    expect(translationLanguageName('urdu')).toBe('Urdu');
    expect(translationLanguageName('azeri')).toBe('Azerbaijani');
    expect(translationLanguageName('divehi')).toBe('Dhivehi');
    expect(translationLanguageName('en')).toBe('English');
    expect(translationLanguageName('English')).toBe('English');
    expect(translationLanguageName('klingon')).toBe('klingon');
    expect(translationLanguageName('')).toBeUndefined();
    expect(translationLanguageName(undefined)).toBeUndefined();
  });

  it('saves verses, footnotes and metadata from the manifest meta in one call', async () => {
    const db = makeDb();
    const store = makeStore();
    const installer = createTranslationInstaller({
      db,
      store,
      settings: makeSettings('saheeh'),
    });
    const outcome = await installer.install(KEY, envelope, {
      name: 'Saheeh International',
      author: 'Saheeh International',
      language: 'english',
      direction: 'ltr',
    });
    expect(db.saveTranslation).toHaveBeenCalledTimes(1);
    const [id, name, englishName, language, direction, verses, footnotes] =
      db.saveTranslation.mock.calls[0];
    expect([id, name, englishName, language, direction]).toEqual([
      '20',
      'Saheeh International',
      'Saheeh International',
      'English',
      'ltr',
    ]);
    expect(verses).toHaveLength(6236);
    expect(verses[0].text).toBe('In the name<sup foot_note=254011>1</sup>');
    expect(footnotes).toEqual([{id: '254011', text: '<p>Note</p>'}]);
    expect(store.state.loadDownloadedMeta).toHaveBeenCalled();
    expect(outcome).toEqual({name: 'Saheeh International'});
  });

  it('keeps the installed name, language and direction on an update without meta', async () => {
    const db = makeDb([
      {
        identifier: '97',
        name: 'Maududi',
        englishName: 'Abul Ala Maududi',
        language: 'Urdu',
        direction: 'rtl',
      },
    ]);
    const installer = createTranslationInstaller({
      db,
      store: makeStore(),
      settings: makeSettings('97'),
    });
    await installer.install('qf:translations:97', envelope, undefined);
    expect(db.saveTranslation.mock.calls[0].slice(0, 5)).toEqual([
      '97',
      'Maududi',
      'Abul Ala Maududi',
      'Urdu',
      'rtl',
    ]);
  });

  it('falls back to placeholders for a fresh install without meta', async () => {
    const db = makeDb();
    const installer = createTranslationInstaller({
      db,
      store: makeStore(),
      settings: makeSettings('saheeh'),
    });
    await installer.install('qf:translations:999', envelope, undefined);
    expect(db.saveTranslation.mock.calls[0].slice(0, 5)).toEqual([
      '999',
      'Translation 999',
      'Translation 999',
      'English',
      'ltr',
    ]);
  });

  it('writes nothing when the snapshot is rejected', async () => {
    const db = makeDb();
    const installer = createTranslationInstaller({
      db,
      store: makeStore(),
      settings: makeSettings('20'),
    });
    await expect(
      installer.install(KEY, makeEnvelope(fullRecords().slice(1)), undefined),
    ).rejects.toThrow('translation_verse_count');
    expect(db.saveTranslation).not.toHaveBeenCalled();
  });

  it('does not change the selection on install', async () => {
    const settings = makeSettings('saheeh');
    const installer = createTranslationInstaller({
      db: makeDb(),
      store: makeStore(),
      settings,
    });
    await installer.install(KEY, envelope, undefined);
    expect(settings.state.setSelectedTranslationId).not.toHaveBeenCalled();
  });

  it('removes the rows and reloads the store', async () => {
    const db = makeDb();
    const store = makeStore();
    const installer = createTranslationInstaller({
      db,
      store,
      settings: makeSettings('saheeh'),
    });
    await installer.remove(KEY);
    expect(db.deleteTranslation).toHaveBeenCalledWith('20');
    expect(store.state.loadDownloadedMeta).toHaveBeenCalled();
  });

  it('moves a withdrawn selected edition to Clear Quran, once', async () => {
    const settings = makeSettings('20');
    const store = makeStore();
    const installer = createTranslationInstaller({
      db: makeDb(),
      store,
      settings,
    });
    await installer.onWithdrawn(KEY);
    expect(settings.state.selectedTranslationId).toBe('clear-quran');
    expect(store.state.loadDownloadedMeta).toHaveBeenCalled();
    await installer.onWithdrawn(KEY);
    expect(settings.state.setSelectedTranslationId).toHaveBeenCalledTimes(1);
  });

  it('leaves another selection alone when an edition is withdrawn', async () => {
    const settings = makeSettings('saheeh');
    const installer = createTranslationInstaller({
      db: makeDb(),
      store: makeStore(),
      settings,
    });
    await installer.onWithdrawn(KEY);
    expect(settings.state.setSelectedTranslationId).not.toHaveBeenCalled();
  });
});
