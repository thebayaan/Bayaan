// @ai-generated
// Component suites use the same English resources as the app. Native MMKV
// storage is unavailable in Jest; individual storage/language suites may
// override this default with their own mocks.
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {resources, defaultNS, namespaces} from '@/i18n/resources';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const values = new Map<string, string | number | boolean>();
    return {
      getString: (key: string) => values.get(key),
      getNumber: (key: string) => values.get(key),
      getBoolean: (key: string) => values.get(key),
      set: (key: string, value: string | number | boolean) =>
        values.set(key, value),
      remove: (key: string) => values.delete(key),
      delete: (key: string) => values.delete(key),
      clearAll: () => values.clear(),
      getAllKeys: () => [...values.keys()],
      contains: (key: string) => values.has(key),
      addOnValueChangedListener: () => ({remove: jest.fn()}),
    };
  },
}));

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS,
  initAsync: false,
  interpolation: {escapeValue: false},
  react: {useSuspense: false},
});
