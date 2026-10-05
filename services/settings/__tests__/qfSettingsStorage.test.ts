jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {QfSettingsStorage} from '../qfSettingsStorage';

describe('QfSettingsStorage device context', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
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
