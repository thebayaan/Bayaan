// @ai-generated
// i18next-cli config: extraction, lint and status checks for the locale files.
// See docs/i18n/README.md for the commands and what CI enforces.
import {defineConfig} from 'i18next-cli';
import {SHIPPED_LANGUAGES, SOURCE_LANGUAGE} from './i18n/languages';

export default defineConfig({
  // Only shipped languages must be complete. In-progress languages are left
  // out so CI doesn't demand (or write) their missing keys; the locale tests
  // still check the keys they do have.
  locales: SHIPPED_LANGUAGES,
  extract: {
    input: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'constants/**/*.{ts,tsx}',
      'data/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'i18n/**/*.{ts,tsx}',
      'services/**/*.{ts,tsx}',
      'store/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}',
    ],
    ignore: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    output: 'i18n/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'common',
    nsSeparator: ':',
    keySeparator: '.',
    primaryLanguage: SOURCE_LANGUAGE,
    // Some keys are built at runtime (`ambient.sounds.${id}`), which static
    // analysis cannot see. Never delete keys automatically.
    removeUnusedKeys: false,
    // Keep keys in the order they were written, grouped by screen.
    sort: false,
  },
  lint: {
    // React Native renders text in these components and props.
    acceptedTags: ['Text', 'TextInput', 'Button'],
    acceptedAttributes: [
      'accessibilityLabel',
      'accessibilityHint',
      'placeholder',
      'title',
    ],
    // Dev-only tools stay in English.
    ignore: ['components/DevMenu.tsx'],
  },
});
