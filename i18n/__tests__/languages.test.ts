// @ai-generated
// Checks the language registry against CLDR (Node's full ICU data) and keeps
// every other list of languages in step with it.
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  DIGIT_ZERO,
  LANGUAGES,
  SHIPPED_LANGUAGES,
  SOURCE_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Script,
  type UiFont,
} from '../languages';
import {resources} from '../resources';

/** Scripts each bundled UI font covers. */
const FONT_SCRIPTS: Record<UiFont, Script[]> = {
  manrope: ['Latn'],
  plexSansArabic: ['Arab', 'Latn'],
  manropeEthiopic: ['Ethi', 'Latn'],
};

/** Scripts whose letters join, where letter spacing breaks words apart. */
const CURSIVE_SCRIPTS: Script[] = ['Arab'];

function cldrDirection(code: string): string | undefined {
  const locale: unknown = new Intl.Locale(code);
  if (
    typeof locale === 'object' &&
    locale !== null &&
    'getTextInfo' in locale &&
    typeof locale.getTextInfo === 'function'
  ) {
    const info: unknown = locale.getTextInfo();
    if (typeof info === 'object' && info !== null && 'direction' in info) {
      return String(info.direction);
    }
  }
  // Node < 22 exposes the older `textInfo` getter instead.
  if (
    typeof locale === 'object' &&
    locale !== null &&
    'textInfo' in locale &&
    typeof locale.textInfo === 'object' &&
    locale.textInfo !== null &&
    'direction' in locale.textInfo
  ) {
    return String(locale.textInfo.direction);
  }
  return undefined;
}

describe.each(SUPPORTED_LANGUAGES)('language "%s"', code => {
  const config = LANGUAGES[code];

  it('is keyed by its own code', () => {
    expect(config.code).toBe(code);
  });

  it('has the CLDR text direction', () => {
    expect(config.direction).toBe(cldrDirection(code));
  });

  it('has the CLDR script', () => {
    expect(config.script).toBe(new Intl.Locale(code).maximize().script);
  });

  it('is named in its own language and script', () => {
    // CLDR gives mid-sentence forms ("français"); the picker capitalizes.
    const displayNames = new Intl.DisplayNames([code], {type: 'language'});
    expect(config.endonym.toLocaleLowerCase(code)).toBe(
      displayNames.of(code)?.toLocaleLowerCase(code),
    );
  });

  it('has the CLDR separators for its digits', () => {
    const parts = new Intl.NumberFormat(
      `${code}-u-nu-${config.digits}`,
    ).formatToParts(12345.6);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    expect(config.groupSeparator).toBe(part('group'));
    expect(config.decimalSeparator).toBe(part('decimal'));
  });

  it('uses a UI font that covers its script', () => {
    expect(FONT_SCRIPTS[config.uiFont]).toContain(config.script);
  });

  it('covers Latin too when it shows English names', () => {
    if (config.bilingualContent === 'en') {
      expect(FONT_SCRIPTS[config.uiFont]).toContain('Latn');
    }
  });

  it('turns letter spacing off for cursive scripts', () => {
    expect(config.allowsLetterSpacing).toBe(
      !CURSIVE_SCRIPTS.includes(config.script),
    );
  });

  it('has locale files', () => {
    expect(Object.keys(resources)).toContain(code);
  });
});

it.each(Object.entries(DIGIT_ZERO))(
  'has the right zero for %s digits',
  (digits, zero) => {
    expect(String.fromCodePoint(zero)).toBe(
      new Intl.NumberFormat(`en-u-nu-${digits}`).format(0),
    );
  },
);

it('ships the source language', () => {
  expect(SHIPPED_LANGUAGES).toContain(SOURCE_LANGUAGE);
});

it('lists the same languages in resources.ts as in the registry', () => {
  expect(Object.keys(resources).sort()).toEqual(
    [...SUPPORTED_LANGUAGES].sort(),
  );
});

it('declares every shipped language to iOS in app.config.js', () => {
  // Read as text: evaluating app.config.js runs the version script.
  const appConfig = readFileSync(
    join(__dirname, '../../app.config.js'),
    'utf8',
  );
  const match = /supportedLocales:\s*{\s*ios:\s*\[([^\]]*)\]/.exec(appConfig);
  expect(match).not.toBeNull();
  const declared = (match?.[1] ?? '')
    .split(',')
    .map(entry => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
  for (const language of SHIPPED_LANGUAGES) {
    expect(declared).toContain(language);
  }
  for (const language of declared) {
    expect(SUPPORTED_LANGUAGES).toContain(language);
  }
});
