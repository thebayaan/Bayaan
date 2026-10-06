jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/components/share/SkiaVersePreview', () => () => null);
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn()},
}));
jest.mock('expo-router', () => ({router: {push: jest.fn()}}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#555555',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('../TafseerHtmlRenderer', () => ({TafseerHtmlRenderer: () => null}));
jest.mock('@/components/Icons', () => ({StackedVolumesIcon: () => null}));
jest.mock('@/services/player/store/playerStore', () => ({usePlayerStore: {}}));
jest.mock('@/services/tafseer/TafseerApiService', () => ({
  tafseerApiService: {},
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {
    getTafseerForVerse: jest.fn(async (_verse: string, id: string) => ({
      text: `Downloaded commentary ${id}`,
      surahNumber: 1,
      fromAyah: 1,
      toAyah: 1,
    })),
  },
}));

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {TafseerContent} from '../TafseerContent';
import {useTafseerStore} from '@/store/tafseerStore';
import type {DownloadedTafseerMeta} from '@/types/tafseer';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';

test('renders a downloaded fallback without overwriting a synced unavailable selection, then adopts it after download', async () => {
  const meta: DownloadedTafseerMeta = {
    identifier: '169',
    name: 'Ibn Kathir',
    englishName: 'Ibn Kathir',
    language: 'en',
    direction: 'ltr',
    downloadedAt: 100,
    verseCount: 6236,
  };
  useTafseerStore.setState({
    selectedTafseerId: 'remote-only',
    downloadedMeta: [meta],
  });
  let screen!: renderer.ReactTestRenderer;
  await act(async () => {
    screen = renderer.create(
      <TafseerContent
        surahNumber={1}
        ayahNumber={1}
        onBack={() => undefined}
      />,
    );
  });
  expect(tafseerDbService.getTafseerForVerse).toHaveBeenLastCalledWith(
    '1:1',
    '169',
  );
  expect(useTafseerStore.getState().selectedTafseerId).toBe('remote-only');
  expect(
    screen.root.findByProps({html: 'Downloaded commentary 169'}).props.html,
  ).toBe('Downloaded commentary 169');
  await act(async () =>
    useTafseerStore.setState({
      downloadedMeta: [meta, {...meta, identifier: 'remote-only'}],
    }),
  );
  expect(tafseerDbService.getTafseerForVerse).toHaveBeenLastCalledWith(
    '1:1',
    'remote-only',
  );
  expect(
    screen.root.findByProps({html: 'Downloaded commentary remote-only'}).props
      .html,
  ).toBe('Downloaded commentary remote-only');
  await act(async () => screen.unmount());
});
