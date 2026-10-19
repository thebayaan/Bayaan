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
import {isActiveQuery, searchPane, useSearch} from '../hooks/useSearch';
import {clearRecentSearches} from '../services/searchRecentsStore';
import {pushScreenBack} from '../services/screenBack';
import {useNavStore} from '../store/navStore';
import {createFocusWithin} from '../services/search/focusWithin';
import {emptyStateCopy} from '../services/search/emptyState';
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

/**
 * Room around the results for a focused card's scale and ring, past the
 * rows' own 12 (ResultSections' scroller bleed).
 */
const BLEED = 24;
const PAD_LEFT = 48;
/** Between the keyboard column and the results. */
const PANE_GAP = 80;

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
  // The top result's first button, and which side focus is on, for the
  // guide that sends Right from the keyboard to that button.
  const [primary, setPrimary] = useState<View | null>(null);
  const [onRight, setOnRight] = useState(false);

  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const favorites = useFavorites();
  const recents = useSearchRecents();
  const {settled, results, suggestions, settleNow} = useSearch(query, reciters);
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
  // Registered first, so the picker's handler below runs before it. Like
  // every screen-back handler it is asked only while Search's own layer is
  // showing (services/screenBack), never under a pushed screen.
  useEffect(
    () =>
      pushScreenBack(() => {
        if (!inResults.inside()) return false;
        inResults.reset();
        setFocusKeyboard(true);
        return true;
      }),
    [inResults],
  );

  // Back closes the picker before it leaves Search. Focus goes to "Choose
  // reciter" only when it was in the picker; from the keyboard it stays put.
  useEffect(() => {
    if (!picker) return;
    return pushScreenBack(() => {
      if (inResults.inside()) closePicker();
      else setPicker(null);
      return true;
    });
  }, [picker, closePicker, inResults]);

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
  const pane = searchPane(query, settled, top !== null);

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
          // "Choose reciter" takes focus as the card remounts, before the
          // player covers Search, so Back from the player lands on it
          // rather than on a picker portrait that no longer exists. The
          // player waits two frames, so the card is mounted natively and
          // has focus before Search's layer is hidden.
          const surah = picker;
          closePicker();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              void actions.playSurah(surah, {reciter});
            }),
          );
        }}
      />
    );
  } else if (pane === 'browse') {
    right = (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.scroll}>
        <BrowsePanel
          reciters={reciters}
          onReciter={actions.openReciter}
          onSurah={surah => void actions.playSurahOrSay(surah)}
          onAdhkar={list => actions.openAdhkar(list)}
          onBrowseAll={tab => useNavStore.getState().jumpTo(tab)}
        />
      </ScrollView>
    );
  } else if (pane === 'results' && top) {
    right = (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.scroll}>
        <TopResultCard
          key={itemKey(top)}
          top={top}
          surahReciter={surahReciter}
          actions={actions}
          onChooseReciter={setPicker}
          takeFocus={focusTopFor !== null && focusTopFor === settled}
          focusChooser={focusChooser}
          primaryRef={setPrimary}
        />
        <ResultSections
          results={results}
          onSurah={surah => void actions.playSurahOrSay(surah)}
          onReciter={actions.openReciter}
          onAdhkar={list => actions.openAdhkar(list)}
        />
      </ScrollView>
    );
  } else {
    // Says what the settled query found nothing for, so it holds steady
    // while more letters settle.
    const copy = emptyStateCopy(settled);
    right = (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{copy.title}</Text>
        <Text style={styles.emptyHint}>{copy.hint}</Text>
      </View>
    );
  }

  const onSuggestion = useCallback(
    (s: Suggestion) => fillAndFocus(s.fill),
    [fillAndFocus],
  );

  return (
    <View style={styles.container}>
      <TVFocusGuideView
        autoFocus
        style={styles.left}
        // Focus on this side means it has left the results, even when the
        // results changed under the focused view and its blur never came.
        onFocus={() => {
          inResults.reset();
          setOnRight(false);
        }}>
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
      {/* Right from the keyboard (or the list under it) lands on the top
          result's first button, not on whichever card of the rows below sits
          nearest the pane's corner. Mounted only while focus is on the left:
          a guide kept with no destinations still redirects natively, and
          unmounting it is what turns it off, so Left from the results goes
          back through the left side's guide to the last key used. */}
      {primary && !onRight && !picker && pane === 'results' ? (
        <TVFocusGuideView destinations={[primary]} style={styles.toTop} />
      ) : null}
      <TVFocusGuideView
        autoFocus
        style={styles.right}
        onFocus={e => {
          inResults.focus(e.nativeEvent.target);
          setOnRight(true);
        }}
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
    paddingLeft: PAD_LEFT,
    paddingRight: 64,
  },
  left: {width: KEYBOARD_WIDTH},
  keyboardGap: {height: 28},
  right: {flex: 1, marginLeft: PANE_GAP},
  // A thin, empty strip down the middle of the gap between the keyboard and
  // the results (absolute, so it takes no part in the row's layout).
  toTop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: PAD_LEFT + KEYBOARD_WIDTH + PANE_GAP / 2 - 1,
    width: 2,
  },
  // The pane's scrollers clip at their own bounds: they reach BLEED past the
  // pane on each side and pad it back, so a focused card's scale and ring at
  // a row's start (or end) are drawn whole rather than cut flat.
  scroller: {marginHorizontal: -BLEED},
  scroll: {paddingTop: 8, paddingBottom: 96, paddingHorizontal: BLEED},
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
