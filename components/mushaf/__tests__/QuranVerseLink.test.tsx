// @ai-generated
/**
 * /quran/{surah}/{ayah} used to redirect to the Home tab. It now hands off to
 * /quran/{surah}?ayah=N, which opens the reader on that verse. The route lives
 * in app/, so its test lives here.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

const mockRedirect = jest.fn((_props: {href: unknown}) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: {href: unknown}) => mockRedirect(props),
  useLocalSearchParams: () => ({surah: '2', ayah: '255'}),
}));

import QuranVerseLink from '@/app/quran/[surah]/[ayah]';

it('redirects to the surah link with the ayah', () => {
  act(() => {
    TestRenderer.create(<QuranVerseLink />);
  });
  expect(mockRedirect).toHaveBeenCalledWith({
    href: {pathname: '/quran/[surah]', params: {surah: '2', ayah: '255'}},
  });
});
