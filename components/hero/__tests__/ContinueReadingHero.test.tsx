// @ai-generated
/**
 * "Continue reading" names the surah the reader named, not the first surah
 * on the last-read page (which is the surah before, for every surah that
 * starts on a shared page: open Ya-Sin, go back, and the card said Fatir).
 */
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (select: (state: unknown) => unknown) =>
    select({recentTracks: []}),
}));
jest.mock('../ContinueListeningHero', () => ({
  ContinueListeningHero: () => null,
  findResumableIndex: () => -1,
}));
jest.mock('../HeroSection', () => ({
  HeroSection: ({mainHero}: {mainHero: React.ReactNode}) => mainHero,
}));
jest.mock('../SurahsHero', () => ({
  SurahHeroSection: () => null,
}));

let mockLastRead: {page: number | null; surahId: number | null} = {
  page: null,
  surahId: null,
};
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastReadPage: () => mockLastRead.page,
    getLastReadSurahId: () => mockLastRead.surahId,
  },
}));
let mockPageToSurah: Record<number, number> | null = null;
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    get initialized() {
      return mockPageToSurah !== null;
    },
    getPageToSurah: () => mockPageToSurah ?? {},
  },
}));

import {ContinueReadingHero} from '../ContinueReadingHero';
import {SurahHeroSection} from '../SurahsHero';

const YA_SIN = 36;

function render(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<ContinueReadingHero />);
  });
  return renderer;
}

const card = (renderer: ReactTestRenderer) =>
  renderer.root.findByType(SurahHeroSection).props as {
    surah: {id: number};
    title: string;
    resumePage?: number;
  };

beforeEach(() => {
  mockFocus = null;
  mockLastRead = {page: null, surahId: null};
  mockPageToSurah = null;
});

describe('ContinueReadingHero', () => {
  it('names the surah saved with the last-read page', () => {
    // Page 604 starts three surahs; the reader was opened for Al-Ikhlas.
    mockLastRead = {page: 604, surahId: 112};
    mockPageToSurah = {604: 114};
    const props = card(render());
    expect(props.surah.id).toBe(112);
    expect(props.title).toBe('hero.continueReading');
    expect(props.resumePage).toBe(604);
  });

  it('names the surah the reader shows for a page saved alone', () => {
    // Page 440 ends Fatir and starts Ya-Sin; the reader header says Ya-Sin.
    mockLastRead = {page: 440, surahId: null};
    mockPageToSurah = {440: YA_SIN};
    expect(card(render()).surah.id).toBe(YA_SIN);
  });

  it('names the same surah before the mushaf data has loaded', () => {
    mockLastRead = {page: 440, surahId: null};
    expect(card(render()).surah.id).toBe(YA_SIN);
  });

  it('re-reads the page and its surah when the tab regains focus', () => {
    mockLastRead = {page: 30, surahId: 2};
    const renderer = render();
    expect(card(renderer).surah.id).toBe(2);
    mockLastRead = {page: 440, surahId: YA_SIN};
    act(() => mockFocus?.());
    expect(card(renderer).surah.id).toBe(YA_SIN);
    expect(card(renderer).resumePage).toBe(440);
  });

  it('shows the surah of the day when nothing was read', () => {
    const props = card(render());
    expect(props.title).toBe('hero.surahOfTheDay');
    expect(props.resumePage).toBeUndefined();
  });
});
