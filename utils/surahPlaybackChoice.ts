// @ai-generated
/**
 * What to do when the user asks to play a surah without picking a reciter
 * (long-press in Search or the Surahs tab, tap in Browse surahs).
 *
 * The answer depends on the "Reciter choice" setting. Every entry point must
 * use this so the options behave the same everywhere.
 */
export type SurahPlaybackAction =
  | 'askReciter'
  | 'browseAll'
  | 'browseFavorites'
  | 'playDefault'
  | 'playRandom';

export function resolveSurahPlaybackAction({
  askEveryTime,
  defaultReciterSelection,
  hasDefaultReciter,
}: {
  askEveryTime: boolean;
  defaultReciterSelection: string | null;
  hasDefaultReciter: boolean;
}): SurahPlaybackAction {
  if (askEveryTime) return 'askReciter';

  switch (defaultReciterSelection) {
    case 'browseAll':
      return 'browseAll';
    case 'searchFavorites':
      return 'browseFavorites';
    case 'useDefault':
      return hasDefaultReciter ? 'playDefault' : 'askReciter';
    case 'randomReciter':
      return 'playRandom';
    default:
      return 'askReciter';
  }
}
