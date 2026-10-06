jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {QfSettingsStorage} from '../qfSettingsStorage';

describe('QfSettingsStorage device context', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('migrates legacy full pending bodies to explicit reconciliation without losing the local snapshot', async () => {
    const storage = new QfSettingsStorage();
    const localDocuments = {mushaf: {showWBW: true, pageLayout: 'fullscreen'}};
    await AsyncStorage.setItem(
      'qf-settings-sync-v1:account-a',
      JSON.stringify({
        version: 1,
        initialized: true,
        localDocuments,
        pending: {
          mushaf: {
            body: JSON.stringify({
              value: localDocuments.mushaf,
              schemaVersion: 1,
            }),
            idempotencyKey: 'legacy',
          },
        },
      }),
    );
    await expect(storage.load('account-a')).resolves.toMatchObject({
      initialized: true,
      needsReconciliation: true,
      pending: {},
      localDocuments,
      syncedDocuments: {},
      syncedLocalDocuments: {},
    });
    await expect(storage.load('account-b')).resolves.toMatchObject({
      needsReconciliation: false,
      localDocuments: {},
    });
  });

  test.each([
    'invalid-json',
    'wrong-schema',
    'invalid-etag',
    'invalid-attempted',
    'unsafe-path',
    'unknown-key',
  ])('does not replay malformed pending state (%s)', async kind => {
    const storage = new QfSettingsStorage();
    const pending: Record<string, unknown> = {
      body: JSON.stringify({schemaVersion: 1, value: {showWBW: true}}),
      idempotencyKey: 'valid-key',
      localSnapshot: {showWBW: true},
      changes: [{path: ['showWBW'], value: true}],
    };
    if (kind === 'invalid-json') pending.body = '{invalid';
    if (kind === 'wrong-schema')
      pending.body = JSON.stringify({schemaVersion: 2, value: {showWBW: true}});
    if (kind === 'invalid-etag') pending.etag = 17;
    if (kind === 'invalid-attempted') pending.attempted = 'true';
    if (kind === 'unsafe-path')
      pending.changes = [{path: ['__proto__', 'value'], value: true}];
    await AsyncStorage.setItem(
      'qf-settings-sync-v1:account-a',
      JSON.stringify({
        version: 1,
        initialized: true,
        syncedDocuments: {},
        syncedLocalDocuments: {},
        localDocuments: {mushaf: {showWBW: true}},
        pending: {[kind === 'unknown-key' ? 'unapproved' : 'mushaf']: pending},
      }),
    );
    await expect(storage.load('account-a')).resolves.toMatchObject({
      needsReconciliation: true,
      pending: {},
      localDocuments: {mushaf: {showWBW: true}},
    });
    await storage.clear('account-a');
    expect(
      await AsyncStorage.getItem('qf-settings-sync-v1:account-a'),
    ).toBeNull();
  });

  test('persists the account-neutral baseline independently of account state', async () => {
    const storage = new QfSettingsStorage();
    const context = {
      version: 1 as const,
      ownerAccountId: 'account-a',
      baselineDocuments: {
        appearance: {themeMode: 'system'},
        mushaf: {selectedTranslationId: 'saheeh'},
        audio: {},
        adhkar: {},
        browsing: {},
      },
      baselinePreferences: [
        {
          group: 'audio',
          key: 'playbackRate',
          value: 1,
        },
      ],
    };

    await storage.saveDeviceContext(context);
    await storage.save('account-a', {
      version: 1,
      initialized: false,
      needsReconciliation: false,
      syncedDocuments: {},
      syncedLocalDocuments: {},
      etags: {},
      pending: {},
      localDocuments: {},
      preferencePending: null,
      localPreferences: [],
      localPreferenceFingerprint: null,
      syncedPreferenceFingerprint: null,
    });

    await expect(storage.loadDeviceContext()).resolves.toEqual(context);
    await expect(storage.load('account-b')).resolves.toMatchObject({
      initialized: false,
      localDocuments: {},
    });
  });
});
