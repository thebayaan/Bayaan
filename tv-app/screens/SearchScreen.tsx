import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {SearchBar} from '../components/search/SearchBar';
import {
  SearchKeyboard,
  KEYBOARD_WIDTH,
} from '../components/search/SearchKeyboard';
import {SearchSideList} from '../components/search/SearchSideList';
import {BrowsePanel} from '../components/search/BrowsePanel';
import {TopResultCard} from '../components/search/TopResultCard';
import {ResultSections} from '../components/search/ResultSections';
import {ReciterPicker} from '../components/search/ReciterPicker';
import {useSearchActions} from '../components/search/useSearchActions';
import {useReciters} from '../hooks/useReciters';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useFavorites} from '../hooks/useFavorites';
import {useSearchRecents} from '../hooks/useSearchRecents';
import {isActiveQuery, useSearch} from '../hooks/useSearch';
import {clearRecentSearches} from '../services/searchRecentsStore';
import {pushScreenBack} from '../services/screenBack';
import {createFocusWithin} from '../services/search/focusWithin';
import {useNavStore} from '../store/navStore';
import {
  deleteKey,
  nextMode,
  typeKey,
  typeSpace,
  type KeyboardMode,
} from '../services/search/keyboard';
import {
  pickReciterForSurah,
  recitersForSurah,
} from '../services/search/playback';
import type {SearchItem} from '../services/search/tvSearch';
import type {Suggestion} from '../services/search/suggestions';
import type {Surah} from '../../data/surahData';
import {colors} from '../theme/colors';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

/** How long a "focus this when it appears" request stays open. */
const FOCUS_REQUEST_MS = 800;

function itemKey(item: SearchItem): string {
  switch (item.type) {
    case 'surah':
      return `s${item.item.id}`;
    case 'reciter':
      return `r${item.item.id}`;
    case 'adhkar':
      return `a${item.item.id}`;
    case 'verse':
      return `v${item.item.surah.id}:${item.item.ayah}`;
  }
}

/**
 * Search (the approved mix): the search bar and a grid keyboard on the left
 * with recent searches, then suggestions, under it; browse tiles on the right
 * before typing, then the top result with its own buttons and rows of more
 * surahs, reciters and adhkar.
 *
 * Focus: the keyboard's first key on arrival. Right from the keyboard enters
 * the results (the top result's first button); Left comes back to the last
 * key used; Down from the keyboard reaches the recents or suggestions; Left
 * from the keyboard's first column opens the sidebar. Back from anywhere in
 * the results returns to the keyboard first, keeping the search; Back again
 * goes Home. Whenever the focused row under the keyboard goes away (recents
 * cleared, a picked recent with no results) focus returns to the keyboard on
 * purpose rather than falling wherever the platform puts it.
 */
export function SearchScreen(): React.ReactElement {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<KeyboardMode>('letters');
  const [picker, setPicker] = useState<Surah | null>(null);
  // Focus requests for elements that appear a moment later: the top result
  // after a suggestion is picked, "Choose reciter" after the picker closes.
  const [focusTopFor, setFocusTopFor] = useState<string | null>(null);
  const [focusChooser, setFocusChooser] = useState(false);
  const [focusKeyboard, setFocusKeyboard] = useState(false);
  const inResults = useRef(createFocusWithin()).current;

  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const favorites = useFavorites();
  const recents = useSearchRecents();
  const {settled, results, suggestions, pending, settleNow} = useSearch(
    query,
    reciters,
  );
  const actions = useSearchActions(settled, reciters, defaultReciterId);

  const favoriteIds = useMemo(
    () => favorites.map(f => f.reciterId),
    [favorites],
  );
  const typing = isActiveQuery(query);

  useEffect(() => {
    if (focusTopFor === null) return;
    const t = setTimeout(() => setFocusTopFor(null), FOCUS_REQUEST_MS);
    return () => clearTimeout(t);
  }, [focusTopFor, settled]);

  useEffect(() => {
    if (!focusChooser) return;
    const t = setTimeout(() => setFocusChooser(false), FOCUS_REQUEST_MS);
    return () => clearTimeout(t);
  }, [focusChooser]);

  useEffect(() => {
    if (!focusKeyboard) return;
    const t = setTimeout(() => setFocusKeyboard(false), FOCUS_REQUEST_MS);
    return () => clearTimeout(t);
  }, [focusKeyboard]);

  // The picker belongs to the query it was opened from; typing closes it, so
  // it never shows one surah while the keyboard says another. Focus is on the
  // keyboard then, so nothing needs to take it.
  useEffect(() => {
    setPicker(null);
  }, [query]);

  const closePicker = useCallback(() => {
    setPicker(null);
    setFocusChooser(true);
  }, []);

  // Back from the results returns to the keyboard before it leaves Search.
  // Registered first, so the picker's handler below runs before it.
  useEffect(
    () =>
      pushScreenBack(() => {
        // Only while Search is the screen showing, not under a pushed one.
        if (useNavStore.getState().stack.length > 0) return false;
        if (!inResults.inside()) return false;
        inResults.reset();
        setFocusKeyboard(true);
        return true;
      }),
    [inResults],
  );

  // Back closes the picker before it leaves Search.
  useEffect(() => {
    if (!picker) return;
    return pushScreenBack(() => {
      closePicker();
      return true;
    });
  }, [picker, closePicker]);

  // A picked recent or suggestion settles at once: its suggestion rows and top
  // result arrive in the same render, so the focused row never unmounts for
  // the debounce and the top result's first button takes focus straight away.
  const fillAndFocus = useCallback(
    (text: string) => {
      setQuery(text);
      settleNow(text);
      setFocusTopFor(text);
    },
    [settleNow],
  );

  const onClearRecents = useCallback(() => {
    // The focused button goes with the list; hand focus to the keyboard in
    // the same render.
    setFocusKeyboard(true);
    clearRecentSearches();
  }, []);

  const surahReciter = useCallback(
    (surah: Surah) =>
      pickReciterForSurah(reciters, surah.id, defaultReciterId, favoriteIds)
        ?.reciter ?? null,
    [reciters, defaultReciterId, favoriteIds],
  );

  const pickerReciters = useMemo(
    () =>
      picker
        ? recitersForSurah(reciters, picker.id, defaultReciterId, favoriteIds)
        : [],
    [picker, reciters, defaultReciterId, favoriteIds],
  );

  const top = results.top;
  const showResults = typing && top !== null;

  // A picked recent that finds nothing has no first button to focus, and its
  // row may have gone; focus goes back to the keyboard instead.
  const pickedNothing =
    focusTopFor !== null && focusTopFor === settled && top === null;
  useEffect(() => {
    if (!pickedNothing) return;
    setFocusTopFor(null);
    setFocusKeyboard(true);
  }, [pickedNothing]);

  let right: React.ReactNode;
  if (picker) {
    right = (
      <ReciterPicker
        surah={picker}
        reciters={pickerReciters}
        onCancel={closePicker}
        onPick={reciter => {
          setPicker(null);
          void actions.playSurah(picker, {reciter});
        }}
      />
    );
  } else if (!typing) {
    right = (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <BrowsePanel
          reciters={reciters}
          onReciter={actions.openReciter}
          onSurah={surah => void actions.playSurahOrSay(surah)}
          onAdhkar={list => actions.openAdhkar(list)}
          onBrowseAll={tab => actions.switchTab(tab)}
        />
      </ScrollView>
    );
  } else if (showResults && top) {
    right = (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <TopResultCard
          key={itemKey(top)}
          top={top}
          surahReciter={surahReciter}
          actions={actions}
          onChooseReciter={setPicker}
          takeFocus={focusTopFor !== null && focusTopFor === settled}
          focusChooser={focusChooser}
        />
        <ResultSections
          results={results}
          onSurah={surah => void actions.playSurahOrSay(surah)}
          onReciter={actions.openReciter}
          onAdhkar={list => actions.openAdhkar(list)}
        />
      </ScrollView>
    );
  } else if (!pending) {
    right = (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No matches for “{query.trim()}”</Text>
        <Text style={styles.emptyHint}>
          Try a surah name or number, a reciter, a verse like 2:255, or a dua
          like “morning”.
        </Text>
      </View>
    );
  } else {
    right = null;
  }

  const onSuggestion = useCallback(
    (s: Suggestion) => fillAndFocus(s.fill),
    [fillAndFocus],
  );

  return (
    <View style={styles.container}>
      <TVFocusGuideView autoFocus style={styles.left}>
        <SearchBar query={query} onChangeQuery={setQuery} />
        <View style={styles.keyboardGap} />
        <SearchKeyboard
          mode={mode}
          onKey={key => setQuery(q => typeKey(q, key))}
          onSpace={() => setQuery(typeSpace)}
          onDelete={() => setQuery(deleteKey)}
          onClear={() => setQuery('')}
          onMode={() => setMode(nextMode)}
          preferFirstKey
          focusLastKey={focusKeyboard}
        />
        <SearchSideList
          typing={typing}
          recents={recents}
          suggestions={suggestions}
          onRecent={fillAndFocus}
          onSuggestion={onSuggestion}
          onClearRecents={onClearRecents}
        />
      </TVFocusGuideView>
      <TVFocusGuideView
        autoFocus
        style={styles.right}
        onFocus={e => inResults.focus(e.nativeEvent.target)}
        onBlur={e => inResults.blur(e.nativeEvent.target)}>
        {right}
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingTop: 84,
    paddingLeft: 48,
    paddingRight: 64,
  },
  left: {width: KEYBOARD_WIDTH},
  keyboardGap: {height: 28},
  right: {flex: 1, marginLeft: 80},
  scroll: {paddingTop: 8, paddingBottom: 96},
  empty: {paddingTop: 120, gap: 14, maxWidth: 760},
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  emptyHint: {...typography.body, color: colors.textSecondary, lineHeight: 30},
});
