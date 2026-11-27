// @ai-generated
import {
  DARK_READING_THEMES,
  LIGHT_READING_THEMES,
} from '@/constants/readingThemes';
import {
  effectiveModeOf,
  isSwipeLayout,
  layoutSettingsFor,
  nextThemeMode,
  pairedThemeId,
  readingLayoutOf,
  toggleCard,
  type ReadingLayout,
} from '../readingLayout';

describe('readingLayoutOf', () => {
  it('maps the Mushaf view to Single page, Book and Scroll', () => {
    expect(readingLayoutOf('mushaf', 'horizontal', 'fullscreen')).toBe(
      'single',
    );
    expect(readingLayoutOf('mushaf', 'horizontal', 'book')).toBe('book');
    expect(readingLayoutOf('mushaf', 'vertical', 'book')).toBe('scroll');
  });

  it('maps the List view to Pages and Continuous', () => {
    expect(readingLayoutOf('list', 'horizontal', 'book')).toBe('pages');
    expect(readingLayoutOf('list', 'vertical', 'fullscreen')).toBe(
      'continuous',
    );
  });
});

describe('layoutSettingsFor', () => {
  it('round-trips every layout through the store values', () => {
    const cases = [
      ['mushaf', 'single'],
      ['mushaf', 'book'],
      ['mushaf', 'scroll'],
      ['list', 'pages'],
      ['list', 'continuous'],
    ] as const;
    for (const [view, layout] of cases) {
      const next = layoutSettingsFor(layout);
      expect(
        readingLayoutOf(
          view,
          next.scrollDirection,
          next.pageLayout ?? 'fullscreen',
        ),
      ).toBe(layout);
    }
  });

  it('leaves the page design alone for the list and scroll layouts', () => {
    expect(layoutSettingsFor('pages').pageLayout).toBeUndefined();
    expect(layoutSettingsFor('scroll').pageLayout).toBeUndefined();
  });

  it('slides sideways only for the swipe layouts', () => {
    const swipes: ReadingLayout[] = ['single', 'book', 'pages'];
    expect(swipes.every(isSwipeLayout)).toBe(true);
    expect(isSwipeLayout('scroll')).toBe(false);
    expect(isSwipeLayout('continuous')).toBe(false);
  });
});

describe('theme mode', () => {
  it('cycles Light, Dark, Auto', () => {
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
    expect(nextThemeMode('system')).toBe('light');
  });

  it('resolves Auto from the device', () => {
    expect(effectiveModeOf('system', 'dark')).toBe('dark');
    expect(effectiveModeOf('system', null)).toBe('light');
    expect(effectiveModeOf('dark', 'light')).toBe('dark');
  });

  it('pairs the theme at the same position when light and dark flip', () => {
    expect(
      pairedThemeId('light', 'dark', LIGHT_READING_THEMES[2].id, 'oled'),
    ).toBe(DARK_READING_THEMES[2].id);
    expect(pairedThemeId('dark', 'light', 'default', 'oled')).toBe(
      LIGHT_READING_THEMES[2].id,
    );
    expect(pairedThemeId('light', 'light', 'white', 'oled')).toBeNull();
  });
});

describe('toggleCard', () => {
  it('keeps one card open at a time', () => {
    expect(toggleCard(null, 'text')).toBe('text');
    expect(toggleCard('text', 'highlights')).toBe('highlights');
    expect(toggleCard('highlights', 'highlights')).toBeNull();
  });
});
