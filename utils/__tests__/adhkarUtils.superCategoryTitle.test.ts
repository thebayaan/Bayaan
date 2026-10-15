// @ai-generated
import i18n from 'i18next';
import {getSuperCategoryDisplayTitle} from '../adhkarUtils';

const morning = {
  id: 'morning-adhkar',
  title: 'Morning',
  arabicTitle: 'أذكار الصباح',
};

afterEach(() => i18n.changeLanguage('en'));

it('reads super-category titles from the active locale', async () => {
  expect(getSuperCategoryDisplayTitle(morning)).toBe('Morning');
  await i18n.changeLanguage('am');
  expect(getSuperCategoryDisplayTitle(morning)).toBe('ጠዋት');
});

it('falls back to the database title for ids the locales do not know', () => {
  expect(
    getSuperCategoryDisplayTitle({
      id: 'server-only',
      title: 'Server Only',
      arabicTitle: 'خادم',
    }),
  ).toBe('Server Only');
});
