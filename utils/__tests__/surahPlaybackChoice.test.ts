// @ai-generated
import {resolveSurahPlaybackAction} from '../surahPlaybackChoice';

const resolve = (
  defaultReciterSelection: string | null,
  {askEveryTime = false, hasDefaultReciter = true} = {},
) =>
  resolveSurahPlaybackAction({
    askEveryTime,
    defaultReciterSelection,
    hasDefaultReciter,
  });

describe('resolveSurahPlaybackAction', () => {
  it('asks for a reciter when "ask every time" is on, whatever the choice', () => {
    for (const selection of [
      'useDefault',
      'randomReciter',
      'browseAll',
      'searchFavorites',
      null,
    ]) {
      expect(resolve(selection, {askEveryTime: true})).toBe('askReciter');
    }
  });

  it('plays with the default reciter when one is set', () => {
    expect(resolve('useDefault')).toBe('playDefault');
  });

  it('falls back to asking when "use default" has no default reciter', () => {
    expect(resolve('useDefault', {hasDefaultReciter: false})).toBe(
      'askReciter',
    );
  });

  it('plays with a random reciter', () => {
    expect(resolve('randomReciter')).toBe('playRandom');
  });

  it('maps the browse choices', () => {
    expect(resolve('browseAll')).toBe('browseAll');
    expect(resolve('searchFavorites')).toBe('browseFavorites');
  });

  it('asks when nothing has been chosen yet or the value is unknown', () => {
    expect(resolve(null)).toBe('askReciter');
    expect(resolve('somethingElse')).toBe('askReciter');
  });
});
