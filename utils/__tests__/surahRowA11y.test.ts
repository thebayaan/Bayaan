// @ai-generated
import i18n from 'i18next';
import {surahRowA11yKeys} from '../surahRowA11y';

const text = (key: string | null) =>
  key ? String(i18n.t(key as never)) : null;

describe('surahRowA11yKeys', () => {
  it('says the row opens the reader where tapping reads', () => {
    const {hintKey} = surahRowA11yKeys({
      pressAction: 'read',
      hasLongPress: false,
    });
    expect(text(hintKey)).toBe('Opens the surah in the reader');
  });

  it('says the row plays where tapping plays', () => {
    const {hintKey} = surahRowA11yKeys({
      pressAction: 'play',
      hasLongPress: false,
    });
    expect(text(hintKey)).toBe('Plays the surah');
  });

  it('offers long-press as a named Play action on reading rows', () => {
    const {longPressLabelKey} = surahRowA11yKeys({
      pressAction: 'read',
      hasLongPress: true,
    });
    expect(text(longPressLabelKey)).toBe('Play');
  });

  it('adds no action when the row has no long-press', () => {
    expect(
      surahRowA11yKeys({pressAction: 'read', hasLongPress: false})
        .longPressLabelKey,
    ).toBeNull();
  });
});
