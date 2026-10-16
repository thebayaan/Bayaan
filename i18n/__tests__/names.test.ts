// @ai-generated
import {sanitizeDisplayNames} from '../names';

it('keeps well-formed names for supported languages', () => {
  expect(sanitizeDisplayNames({am: ' ሚሻሪ ', ar: 'مشاري'})).toEqual({
    am: 'ሚሻሪ',
    ar: 'مشاري',
  });
});

it('drops unsupported languages, non-strings and unsafe values', () => {
  expect(
    sanitizeDisplayNames({
      xx: 'Name',
      am: 42,
      ar: 'abc\u202Edef',
      en: 'a'.repeat(121),
    }),
  ).toBeUndefined();
  expect(sanitizeDisplayNames({am: 'line\nbreak'})).toBeUndefined();
});

it('ignores anything that is not a plain object', () => {
  expect(sanitizeDisplayNames(null)).toBeUndefined();
  expect(sanitizeDisplayNames('am')).toBeUndefined();
  expect(sanitizeDisplayNames(['am'])).toBeUndefined();
});

it('normalises to NFC', () => {
  expect(sanitizeDisplayNames({en: 'Cafe\u0301'})).toEqual({en: 'Café'});
});
