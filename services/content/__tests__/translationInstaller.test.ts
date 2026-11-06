jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

import {SURAHS} from '@/data/surahData';
import type {ContentEnvelope} from '@/types/content';
import {createTranslationInstaller} from '../translationInstaller';

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

function makeHost(selected: string) {
  const host = {
    selected,
    selectedTranslationId: () => host.selected,
    setSelectedTranslationId: jest.fn((id: string) => {
      host.selected = id;
    }),
    reloadTranslations: jest.fn().mockResolvedValue(undefined),
  };
  return host;
}

describe('translation installer', () => {
  it('saves verses, footnotes and metadata from the manifest meta in one call', async () => {
    const db = makeDb();
    const host = makeHost('saheeh');
    const installer = createTranslationInstaller({db, host});
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
    expect(host.reloadTranslations).toHaveBeenCalled();
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
      host: makeHost('97'),
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
      host: makeHost('saheeh'),
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
      host: makeHost('20'),
    });
    await expect(
      installer.install(KEY, makeEnvelope(fullRecords().slice(1)), undefined),
    ).rejects.toThrow('translation_verse_count');
    expect(db.saveTranslation).not.toHaveBeenCalled();
  });

  it('does not change the selection on install', async () => {
    const host = makeHost('saheeh');
    const installer = createTranslationInstaller({
      db: makeDb(),
      host,
    });
    await installer.install(KEY, envelope, undefined);
    expect(host.setSelectedTranslationId).not.toHaveBeenCalled();
  });

  it('removes the rows and reloads the translations list', async () => {
    const db = makeDb();
    const host = makeHost('saheeh');
    const installer = createTranslationInstaller({db, host});
    await installer.remove(KEY);
    expect(db.deleteTranslation).toHaveBeenCalledWith('20');
    expect(host.reloadTranslations).toHaveBeenCalled();
  });

  it('moves a withdrawn selected edition to Clear Quran, once', async () => {
    const host = makeHost('20');
    const installer = createTranslationInstaller({
      db: makeDb(),
      host,
    });
    await installer.onWithdrawn(KEY);
    expect(host.selected).toBe('clear-quran');
    await installer.onWithdrawn(KEY);
    expect(host.setSelectedTranslationId).toHaveBeenCalledTimes(1);
  });

  it('leaves another selection alone when an edition is withdrawn', async () => {
    const host = makeHost('saheeh');
    const installer = createTranslationInstaller({
      db: makeDb(),
      host,
    });
    await installer.onWithdrawn(KEY);
    expect(host.setSelectedTranslationId).not.toHaveBeenCalled();
  });
});
