// @ai-generated
/** What tapping a surah row does on the screen that shows it. */
export type SurahRowPressAction = 'play' | 'read';

/**
 * Translation keys for a surah row's VoiceOver hint and long-press action.
 *
 * The same row opens the reader on some screens (Surahs tab, Search,
 * Mushaf search) and plays on others (reciter profile, Browse surahs), so
 * the hint must follow the screen. Long-press is a hidden gesture, so when
 * a row has one it is also offered as a named action ("Play" where tapping
 * reads).
 */
export function surahRowA11yKeys({
  pressAction,
  hasLongPress,
}: {
  pressAction: SurahRowPressAction;
  hasLongPress: boolean;
}): {
  hintKey: 'home:surahItem.a11yReadHint' | 'home:surahItem.a11yPlayHint';
  longPressLabelKey:
    | 'home:surahItem.a11yPlayAction'
    | 'home:surahItem.a11yMoreAction'
    | null;
} {
  return {
    hintKey:
      pressAction === 'read'
        ? 'home:surahItem.a11yReadHint'
        : 'home:surahItem.a11yPlayHint',
    longPressLabelKey: !hasLongPress
      ? null
      : pressAction === 'read'
        ? 'home:surahItem.a11yPlayAction'
        : 'home:surahItem.a11yMoreAction',
  };
}
