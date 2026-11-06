// @ai-generated
import {BayaanSettingsApiError} from '@/services/settings/bayaanSettingsApiClient';
import {
  syncInstalledContent,
  type InstalledContent,
  type QfInstalledContentDeps,
} from '@/services/library/qfInstalledContentSync';

jest.mock('expo-crypto', () => ({randomUUID: () => 'uuid'}));

function harness(options: {
  remote?: {translations?: string[]; tafsirs?: string[]} | null;
  installed: InstalledContent;
  offered?: InstalledContent;
  readOnly?: boolean;
}) {
  const puts: unknown[] = [];
  const offers: InstalledContent[] = [];
  let offered = options.offered ?? {translations: [], tafsirs: []};
  const deps: QfInstalledContentDeps = {
    api: {
      getDocument: jest.fn(async () =>
        options.remote === null || options.remote === undefined
          ? null
          : {
              key: 'content' as never,
              value: options.remote,
              etag: '"e1"',
              readOnly: options.readOnly ?? false,
            },
      ),
      putDocument: jest.fn(async (_token, input) => {
        puts.push({...input, body: JSON.parse(input.body)});
        return '"e2"';
      }),
    },
    readInstalled: async () => options.installed,
    offerDownloads: async missing => void offers.push(missing),
    offered: {
      load: async () => offered,
      save: async (_account, next) => void (offered = next),
    },
  };
  const run = () =>
    syncInstalledContent(deps, {
      accountId: 'acct',
      sessionToken: 't',
      isCurrent: () => true,
    });
  return {deps, puts, offers, run, offered: () => offered};
}

describe('syncInstalledContent', () => {
  it('creates the list from this device on first sync', async () => {
    const h = harness({
      remote: null,
      installed: {translations: ['en.sahih'], tafsirs: ['169']},
    });
    expect(await h.run()).toEqual({rerun: false, unavailable: false});
    expect(h.puts).toEqual([
      {
        key: 'content',
        idempotencyKey: 'uuid',
        body: {
          schemaVersion: 1,
          value: {translations: ['en.sahih'], tafsirs: ['169']},
        },
      },
    ]);
    expect(h.offers).toEqual([]);
  });

  it('adds local editions to the list and offers the missing ones once', async () => {
    const h = harness({
      remote: {translations: ['en.sahih', 'ur.jalandhry'], tafsirs: ['169']},
      installed: {translations: ['en.sahih', 'fr.hamidullah'], tafsirs: []},
    });
    await h.run();
    expect(h.puts).toEqual([
      expect.objectContaining({
        etag: '"e1"',
        body: {
          schemaVersion: 1,
          value: {
            translations: ['en.sahih', 'fr.hamidullah', 'ur.jalandhry'],
            tafsirs: ['169'],
          },
        },
      }),
    ]);
    expect(h.offers).toEqual([
      {translations: ['ur.jalandhry'], tafsirs: ['169']},
    ]);
    await h.run();
    expect(h.offers).toHaveLength(1);
  });

  it('writes nothing when the list already covers this device', async () => {
    const h = harness({
      remote: {translations: ['en.sahih'], tafsirs: []},
      installed: {translations: ['en.sahih'], tafsirs: []},
    });
    await h.run();
    expect(h.puts).toEqual([]);
  });

  it('never downgrades a newer document but still offers from it', async () => {
    const h = harness({
      remote: {translations: ['ur.jalandhry'], tafsirs: []},
      installed: {translations: ['en.sahih'], tafsirs: []},
      readOnly: true,
    });
    await h.run();
    expect(h.puts).toEqual([]);
    expect(h.offers).toEqual([{translations: ['ur.jalandhry'], tafsirs: []}]);
  });

  it('reruns on a conflict and reports App State being off as unavailable', async () => {
    const h = harness({
      remote: null,
      installed: {translations: ['a'], tafsirs: []},
    });
    (h.deps.api.putDocument as jest.Mock).mockRejectedValueOnce(
      new BayaanSettingsApiError(412, 'QF_SETTINGS_CONFLICT'),
    );
    expect(await h.run()).toEqual({rerun: true, unavailable: false});
    (h.deps.api.getDocument as jest.Mock).mockRejectedValueOnce(
      new BayaanSettingsApiError(400, 'QF_SETTINGS_REJECTED'),
    );
    expect(await h.run()).toEqual({rerun: false, unavailable: true});
    (h.deps.api.getDocument as jest.Mock).mockRejectedValueOnce(
      new BayaanSettingsApiError(401, 'QF_SESSION_INVALID'),
    );
    await expect(h.run()).rejects.toMatchObject({code: 'session_revoked'});
  });

  it('ignores malformed edition ids from the cloud', async () => {
    const h = harness({
      remote: {translations: ['ok', 'bad id!', 5 as never], tafsirs: []},
      installed: {translations: [], tafsirs: []},
    });
    await h.run();
    expect(h.offers).toEqual([{translations: ['ok'], tafsirs: []}]);
  });
});
