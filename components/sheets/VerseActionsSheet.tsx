import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'; // @ai
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions, // @ai
  Platform,
  LayoutAnimation,
  UIManager,
  ActivityIndicator, // @ai
  type StyleProp, // @ai
  type ViewStyle, // @ai
} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SheetProps} from 'react-native-actions-sheet';
import ActionSheet, {
  type AdaptiveActionSheetProps, // @ai
} from '@/components/sheets/AdaptiveActionSheet';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {BackIcon} from '@/components/ActionIcons'; // @ai
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {lightHaptics} from '@/utils/haptics';
import {
  PlayIcon,
  RepeatIcon,
  StackedVolumesIcon,
  PageQuillIcon,
  MirrorWavesIcon,
  HighlightIcon,
  ChainLinksIcon,
  GroupedLinesIcon,
  BreakdownIcon,
  CopyIcon,
  ShareIcon,
} from '@/components/Icons';
import Color from 'color';
import {router} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';
// @ai-start
import {
  isReaderOpen,
  useMushafNavigationStore,
} from '@/store/mushafNavigationStore';
// @ai-end
import {
  resolvePlayFromHere, // @ai
  useTimestampStore,
} from '@/store/timestampStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {loadPlainTranslations} from '@/services/translation/plainTranslations'; // @ai
import {stripTranslationMarkup} from '@/utils/translationMarkup'; // @ai
import * as Clipboard from 'expo-clipboard';
import {getRewayahShortLabel} from '@/utils/rewayahLabels';
// @ai-start
import {showToast} from '@/utils/toastUtils';
import {
  formatQuranCitation,
  hasNoOwnText,
  joinVerseTexts,
  noOwnTextMessage,
} from '@/components/share/rewayahVerseText';
import {
  formatVerseCopyText,
  joinTranslationParts,
  qulVerseKey,
  requestHafsKeys, // @ai
  resolveSelectionTexts,
  selectionPlaybackKeys,
  selectionTranslationParts,
  type PendingVerseSelection,
  type ReadyVerseSelection,
  type VerseSelectionRequest,
} from '@/components/share/rewayahVerseSelection';
import {
  useRequireSelection,
  useSelectionVerseTexts,
  useVerseSelection,
} from '@/components/share/useVerseSelection';
import {
  setSelectionBookmarked,
  setSelectionHighlight,
  useSelectionBookmarked,
  useSelectionHighlightColor,
} from './verse-actions/selectionAnnotations';
// @ai-end
import branding from '@/config/branding';
import {HighlightContent} from './verse-actions/HighlightContent';
import {NoteContent} from './verse-actions/NoteContent';
import {ShareContent} from './verse-actions/ShareContent';
import {SimilarVersesContent} from './verse-actions/SimilarVersesContent';
import {TranslationContent} from './verse-actions/TranslationContent';
import {TafseerContent} from './verse-actions/TafseerContent';
import {ThemeContent} from './verse-actions/ThemeContent';
import {WBWContent} from './verse-actions/WBWContent';
// @ai-start
import {WordStudyContent} from './verse-actions/WordStudyContent';
// @ai-start
import {RootSearchContent} from './verse-actions/RootSearchContent';
// @ai-end
import type {WordRef} from './verse-actions/wordStudy';
import {
  hafsVerseWordParts,
  selectionWordParts,
  type WordStudySubject,
} from './verse-actions/verseUnitScreens';
// @ai-end
// @ai-start
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {flipX} from '@/utils/rtl';
// @ai-end
import {useKeyCommands} from '@/hooks/useKeyCommands';
import {
  keyCommandsSupported,
  type KeyBinding,
  type KeyId,
} from '@/services/keyboard/keyCommands';
import {CommunityReflectionsContent} from './verse-actions/CommunityReflectionsContent';
import {SheetScrollView} from './verse-actions/sheetGestures';
import {
  hideSheet as hideAnySheet,
  showSheet,
} from '@/components/sheets/sheetControl'; // @ai
import {useNativeSheetLevel} from '@/components/native/nativeSheetContext'; // @ai
import {setNativeSheetDetents} from '@/components/native/nativeSheets'; // @ai
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai

const surahData = require('@/data/surahData.json');

type ActiveScreen =
  | 'highlight'
  | 'note'
  | 'share'
  | 'similar'
  | 'phrases'
  | 'translation'
  | 'tafseer'
  | 'theme'
  | 'wbw'
  | 'words' // @ai: Word Study (was the I'rab screen)
  | 'root' // @ai: root search from Word Study
  | 'community-reflections'
  | null;

// @ai-start
const SCREEN_TITLE_KEYS = {
  highlight: 'verseActions.highlight',
  note: 'verseActions.addNote',
  share: 'common:actions.share',
  similar: 'verseActions.similarVerses',
  phrases: 'verseActions.sharedPhrases',
  translation: 'verseActions.translation',
  tafseer: 'verseActions.tafseer',
  theme: 'verseActions.theme',
  wbw: 'verseActions.wordByWord',
  words: 'verseActions.wordStudy',
  root: 'verseActions.rootSearch',
  'community-reflections': 'verseActions.communityReflections',
} as const;
// @ai-end

// @ai-start
// Share of the window height a sub-screen (translation, tafsir…) fills.
// Read from useWindowDimensions at render, not once at import: the Mushaf
// rotates, and a portrait height overflows the screen in landscape.
const SHEET_HEIGHT_FRACTION = 0.85;

// Why the sheet is asked to close (the library's CloseRequestType, which its
// package entry does not export): a swipe, a backdrop tap, or BACK_PRESS:
// Android's back button, its back gesture or a hardware keyboard's Escape.
type CloseRequest = Parameters<
  NonNullable<AdaptiveActionSheetProps['onRequestClose']>
>[0];
const BACK_PRESS = 1 as CloseRequest;
// @ai-end

// iPad keys that act on the screen under the sheet: the reader's page turns
// (Space, Shift-Space, the arrows) and the full player's seeks (the arrows).
// The sheet covers them while it shows; Word Study binds the arrows itself.
// A cover never takes an app-wide key, so over the full player, where Space
// is the app-wide play / pause, Space still plays and pauses.
const NO_KEY_BINDINGS: readonly KeyBinding[] = [];
const COVERED_KEYS: readonly KeyId[] = [
  'space',
  'shift-space',
  'left',
  'right',
];
const COVERED_KEYS_WORD_STUDY: readonly KeyId[] = ['space', 'shift-space'];

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// @ai-start
/**
 * In place of a screen while the selected verses of another rewayah cannot
 * be named: its verse units are loading or were refused, or the payload
 * names no verse of it (the unnumbered Fatiha basmala of the Madani and
 * Basri counts).
 */
function SelectionPendingView({
  selection,
  theme,
  style,
}: {
  selection: PendingVerseSelection;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  const {t} = useTranslation('sheets');
  const label = getRewayahShortLabel(selection.rewayah);
  return (
    <View style={[pendingStyles.container, style]}>
      {selection.status === 'loading' ? (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      ) : (
        <Text
          style={[
            pendingStyles.text,
            {color: Color(theme.colors.text).alpha(0.6).toString()},
          ]}>
          {t(
            selection.status === 'invalid'
              ? 'verseActions.unnumbered'
              : 'verseActions.loadFailed',
            {rewayah: label},
          )}
        </Text>
      )}
    </View>
  );
}

const pendingStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(40),
    paddingHorizontal: moderateScale(16),
  },
  text: {
    fontSize: moderateScale(13),
    fontFamily: 'Manrope-Medium',
    textAlign: 'center',
  },
});
// @ai-end

export const VerseActionsSheet = (props: SheetProps<'verse-actions'>) => {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(30)); // @ai
  const {height: windowHeight} = useWindowDimensions(); // @ai
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // @ai-start
  // Word Study only (payload.wordStudyOnly): the words of something that is
  // no verse of the sheet's rewayah (the unnumbered Fatiha basmala of the
  // Madani and Basri counts). The sheet shows Word Study and root search
  // alone: no verse is selected or waited for, the verse menu (whose
  // actions act on verses) is never shown, and back from Word Study closes
  // the sheet.
  const wordStudyOnly = props.payload?.wordStudyOnly === true;
  // A word long-press opens the sheet on Word Study at that word. The sheet
  // unmounts when hidden, so this runs on every show.
  const [activeScreen, setActiveScreenRaw] = useState<ActiveScreen>(
    props.payload?.initialScreen === 'words' || wordStudyOnly ? 'words' : null,
  );
  // The word Word Study opens on (Hafs verse + word-by-word position).
  const [wordTarget, setWordTarget] = useState<WordRef | undefined>(
    props.payload?.word,
  );
  // The root (and lemma) the root screen shows.
  const [rootTarget, setRootTarget] = useState<{
    root: string;
    lemma: string | null;
  } | null>(null);
  // @ai-end
  // Word Study opened by a long-press in Word by Word goes back there.
  const [wordStudyFromWbw, setWordStudyFromWbw] = useState(false);

  const setActiveScreen = useCallback((screen: ActiveScreen) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'),
    );
    setActiveScreenRaw(screen);
  }, []);

  // @ai-start
  // A native sheet sizes this view to its detent, so the menu fills it and
  // scrolls instead of running past the bottom edge.
  const nativeLevel = useNativeSheetLevel();
  const inNativeSheet = nativeLevel !== null;
  // Hides a native sheet too (sheetControl), resolving once it is gone.
  const hideSheet = useCallback(
    (): Promise<unknown> => hideAnySheet('verse-actions'),
    [],
  );
  // @ai-end

  const hideCurrentSheet = useCallback(() => {
    hideSheet().catch(error => {
      console.warn('[VerseActionsSheet] Failed to hide sheet:', error);
    });
  }, [hideSheet]);

  const payload = props.payload;
  const verseKey = payload?.verseKey ?? '';
  const surahNumber = payload?.surahNumber ?? 0;
  const ayahNumber = payload?.ayahNumber ?? 0;
  const verseKeys = payload?.verseKeys;
  const unitKeys = payload?.unitKeys; // @ai
  const source = payload?.source;

  const selectedTranslationId = useMushafSettingsStore(
    s => s.selectedTranslationId,
  );

  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const resolvedRewayah = payload?.rewayah ?? mushafRewayah;

  // @ai-start
  // The verses this sheet acts on, in the shown rewayah's OWN numbering
  // (decision 3): the payload's unit keys, or the rewayah verses holding its
  // Hafs verses. Header, copy, share, bookmark / highlight / note rows and
  // playback all read this selection. Hafs: the payload's Hafs keys, as
  // before (see components/share/rewayahVerseSelection.ts).
  const selectionRequest = useMemo<VerseSelectionRequest>(
    () => ({
      rewayah: resolvedRewayah,
      verseKey,
      surahNumber,
      ayahNumber,
      verseKeys,
      unitKeys,
    }),
    [resolvedRewayah, verseKey, surahNumber, ayahNumber, verseKeys, unitKeys],
  );
  // Word Study only selects nothing: in that mode this selection and the
  // texts below are never read (for the basmala, which is no verse, they
  // never become ready). The hooks still run, as hooks do; what they load
  // is the rewayah's verse units and words, which the basmala row was drawn
  // from.
  const selection = useVerseSelection(selectionRequest);
  const readySelection = selection.status === 'ready' ? selection : null;
  const isRange = readySelection
    ? readySelection.isRange
    : (unitKeys ?? verseKeys ?? []).length > 1;

  // Arabic text always comes from the resolved rewayah's words DB (loaded on
  // demand when it is not the active one), never from the static Hafs JSON
  // and never from a caller-supplied string of unknown rewayah. Another
  // rewayah's verses are its verse units: exactly their slots.
  const arabicTexts = useSelectionVerseTexts(selection);
  const [isCopying, setIsCopying] = useState(false);

  // Translations are Hafs-aligned: every Hafs verse the selection reads,
  // once, with a note under a Hafs verse the rewayah divides (contract 4.6).
  // The caller's translation (the player passes the one it shows) is its
  // verse's: used, as before, when the selection reads exactly that one
  // Hafs verse; any other selection uses the selected translation for every
  // Hafs verse, so one copy never mixes two translations.
  const translationFor = useCallback(
    async (ready: ReadyVerseSelection) => {
      const parts = selectionTranslationParts(ready);
      const callerTranslation =
        parts.length === 1 && parts[0].hafsKey === verseKey
          ? payload?.translation
          : undefined;
      // Plain text: the stored text carries footnote markers, which pasted
      // as `<sup foot_note="…">1</sup>` in the middle of the verse.
      if (callerTranslation) {
        return joinTranslationParts(parts, () =>
          stripTranslationMarkup(callerTranslation),
        );
      }
      // Also reads a downloaded translation from its database when it is
      // not in memory yet (right after launch), instead of copying none.
      return joinTranslationParts(
        parts,
        await loadPlainTranslations(
          parts.map(part => part.hafsKey),
          selectedTranslationId,
        ),
      );
    },
    [verseKey, payload?.translation, selectedTranslationId],
  );

  // The selection for an action, waiting (bounded) for another rewayah's
  // verse units while they load; null after telling the user why nothing
  // could be done.
  const requireSelection = useRequireSelection(selection, selectionRequest);
  // @ai-end

  const surah = surahData.find(
    (s: {id: number; name: string; name_arabic: string}) =>
      s.id === selection.surahNumber, // @ai
  );
  const surahName = surah ? getSurahDisplayName(surah) : '';

  // @ai-start
  // "2:1", "2:1-3" or "2:286 - 3:2" in the shown rewayah's numbering; no
  // number until its verses can be named (never a Hafs number under a
  // rewayah's name).
  const verseRefText = readySelection ? readySelection.label : '';

  // Rows are stored by each verse's Hafs anchor, and a verse is marked by
  // any row that names it (a bare "S:A" names every verse holding words of
  // that Hafs verse), legacy rows included (contract section 3; see
  // verse-actions/selectionAnnotations.ts). Hafs: the Hafs keys themselves,
  // as before.
  const isBookmarked = useSelectionBookmarked(readySelection);
  const isHighlighted = useSelectionHighlightColor(readySelection) !== null;

  const pendingSelection: PendingVerseSelection | null =
    selection.status === 'ready' ? null : selection;
  // Where the pagers (translation, tafsir) and the Hafs-part screens (theme,
  // word by word) start in another rewayah; undefined for Hafs, whose
  // screens page Hafs verses as before.
  const unitStart = useMemo(
    () =>
      readySelection?.model && readySelection.units
        ? {model: readySelection.model, unit: readySelection.units[0]}
        : undefined,
    [readySelection],
  );

  // What Word Study studies: the selected verses' words (another rewayah's
  // cut to its own words), or in Word Study only mode the payload's Hafs
  // verses (the basmala: Hafs 1:1), from the payload alone and captioned
  // as another rewayah's are ("Hafs 1:1"): no selection can name them.
  const wordStudy = useMemo<WordStudySubject | null>(() => {
    if (wordStudyOnly) {
      return {
        rewayah: resolvedRewayah,
        parts: hafsVerseWordParts(
          requestHafsKeys(selectionRequest),
          resolvedRewayah,
        ),
      };
    }
    return readySelection
      ? {
          rewayah: readySelection.rewayah,
          parts: selectionWordParts(readySelection),
        }
      : null;
  }, [wordStudyOnly, resolvedRewayah, selectionRequest, readySelection]);
  // @ai-end

  const handleToggleBookmark = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('saved'));
    if (!ready) return;
    // @ai-end
    // A persistence failure must never strand the sheet open: without this
    // guard a rejected write skipped both the optimistic store update and
    // SheetManager.hide, freezing the sheet with no feedback. The DB write is
    // now idempotent (INSERT OR IGNORE) so the duplicate case can't reject at
    // all; this is the belt-and-braces for anything else (disk, migration).
    // @ai
    try {
      // Removing deletes every row that marks a selected verse; adding
      // writes one row per verse at its anchor. @ai
      await setSelectionBookmarked(ready, !isBookmarked); // @ai
    } catch (error) {
      console.error('[VerseActionsSheet] Bookmark toggle failed:', error);
    }
    await hideSheet();
  }, [
    readySelection, // @ai
    requireSelection, // @ai
    isBookmarked,
    hideSheet,
  ]);

  const handleHighlight = useCallback(async () => {
    // @ai-start
    // Highlighted implies a ready selection (its rows were looked up).
    // Removing deletes every row that marks a selected verse.
    if (isHighlighted && readySelection) {
      lightHaptics();
      // A failed write (one transaction: nothing changed) must not strand
      // the sheet open, as in handleToggleBookmark.
      try {
        await setSelectionHighlight(readySelection, null);
      } catch (error) {
        console.error('[VerseActionsSheet] Highlight removal failed:', error);
      }
      hideCurrentSheet();
    } else {
      setActiveScreen('highlight');
    }
    // @ai-end
  }, [readySelection, isHighlighted, hideCurrentSheet]);

  const handleNote = useCallback(() => {
    setActiveScreen('note');
  }, []);

  // @ai-start
  const handleCopy = useCallback(async () => {
    if (isCopying) return;
    lightHaptics();
    setIsCopying(true);
    try {
      // Waits (bounded) for the rewayah's verses and words when they are
      // still loading.
      const ready = readySelection ?? (await requireSelection('copied'));
      if (!ready) return;
      const result =
        ready === selection && arabicTexts.status === 'ready'
          ? arabicTexts
          : await resolveSelectionTexts(ready);
      if (result.status !== 'ready') {
        showToast(
          // @ai-start
          t('selectionFailure.loadFailed', {
            rewayah: getRewayahShortLabel(resolvedRewayah),
          }),
          t('selectionFailure.nothingDoneRetry.copied'),
          // @ai-end
          'error',
        );
        return;
      }
      if (hasNoOwnText(result.texts)) {
        showToast(
          t('selectionFailure.nothingToCopy'), // @ai
          noOwnTextMessage(result.rewayah),
          'error',
        );
        return;
      }
      // Each verse exactly as the mushaf shows it, with its own marker; the
      // citation in the rewayah's numbering ("Quran 2:1 · Warsh").
      await Clipboard.setStringAsync(
        formatVerseCopyText(
          joinVerseTexts(result.texts),
          await translationFor(ready),
          formatQuranCitation(ready.label, result.rewayah),
        ),
      );
      await hideSheet();
    } finally {
      setIsCopying(false);
    }
  }, [
    isCopying,
    readySelection,
    requireSelection,
    selection,
    arabicTexts,
    resolvedRewayah,
    translationFor,
    hideSheet,
  ]);
  // @ai-end

  const handleShare = useCallback(() => {
    lightHaptics();
    setActiveScreen('share');
  }, []);

  const handleTranslation = useCallback(() => {
    setActiveScreen('translation');
  }, []);

  const handleTafseer = useCallback(() => {
    setActiveScreen('tafseer');
  }, []);

  const handleTheme = useCallback(() => {
    setActiveScreen('theme');
  }, []);

  const handleWBW = useCallback(() => {
    setActiveScreen('wbw');
  }, []);

  // @ai-start
  // The row opens Word Study on the selection's first word.
  const handleWordStudy = useCallback(() => {
    setWordTarget(undefined);
    setWordStudyFromWbw(false);
    setActiveScreen('words');
  }, [setActiveScreen]);

  // A long-press in the Word by Word screen studies that word (Word Study
  // opens on the selection's first word when it is not one of its words).
  const handleOpenWord = useCallback(
    (word: WordRef) => {
      setWordTarget(word);
      setWordStudyFromWbw(true);
      setActiveScreen('words');
    },
    [setActiveScreen],
  );
  // @ai-end

  // RFC-018 — open the community-reflections popup. Only reachable when a
  // fork wires branding.communityReflectionsProvider (the row is gated).
  const handleCommunityReflections = useCallback(() => {
    setActiveScreen('community-reflections');
  }, []);

  // QUL data: theme label and per-feature availability
  const [hasSimilarVerses, setHasSimilarVerses] = useState(false);
  const [hasSharedPhrases, setHasSharedPhrases] = useState(false);

  // @ai-start
  // QUL data is per Hafs verse: offered for a single verse that is exactly
  // one whole Hafs verse (Hafs: the payload's verse, as before). Word Study
  // only has no verse, so nothing to look up.
  const qulKey = wordStudyOnly
    ? null
    : qulVerseKey(selection, {surahNumber, ayahNumber});

  useEffect(() => {
    if (!qulKey) return;
    let cancelled = false;
    const vk = qulKey;
    // @ai-end

    (async () => {
      const [similar, phrases] = await Promise.all([
        qulDataService.hasSimilarVerses(vk),
        qulDataService.hasSharedPhrases(vk),
      ]);
      if (cancelled) return;
      setHasSimilarVerses(similar);
      setHasSharedPhrases(phrases);
    })();

    return () => {
      cancelled = true;
    };
  }, [qulKey]); // @ai

  const handleSimilarVerses = useCallback(() => {
    setActiveScreen('similar');
  }, []);

  const handleSharedPhrases = useCallback(() => {
    setActiveScreen('phrases');
  }, []);

  const startPlaybackForSelection = useCallback(
    async (loop: boolean) => {
      lightHaptics();
      // @ai-start
      const ready = readySelection ?? (await requireSelection('played'));
      if (!ready) return;
      // The selected verses of a non-Hafs rewayah play as its own verses
      // (verse-units contract 4.2): exactly them when the reciter's timings
      // are numbered by that rewayah, else the whole Hafs verses holding
      // them. `firstKey` / `lastKey` are the Hafs verses holding the
      // selection (page lookups); a Hafs selection plays them as before.
      const units = ready.units;
      const {firstHafsKey: firstKey, lastHafsKey: lastKey} =
        selectionPlaybackKeys(ready);
      // @ai-end
      const store = useMushafPlayerStore.getState();

      if (!store.rewayatId) {
        const page =
          digitalKhattDataService.getPageForVerse(firstKey) ||
          store.currentPage ||
          1;
        useMushafPlayerStore.setState({
          currentPage: page,
          pendingStartVerseKey: firstKey,
        });
        if (units) store.setPendingStart(units[0]); // @ai
        await hideSheet();
        showSheet('mushaf-player-options', {
          payload: {currentPage: page},
        });
        return;
      }

      const [startS, startA] = firstKey.split(':').map(Number);
      const [endS, endA] = lastKey.split(':').map(Number);

      const page =
        digitalKhattDataService.getPageForVerse(firstKey) ||
        store.currentPage ||
        1;

      store.stop();

      // @ai-start
      if (loop && units) {
        // One verse repeats as a verse (Repeat of Warsh 1:6 loops Warsh
        // 1:6 only), several loop as a range.
        store.setUnitRange(units[0], units[units.length - 1]);
        store.setVerseRepeatCount(units.length > 1 ? 1 : 0);
        store.setRangeRepeatCount(0);
      } else if (units && ready.model) {
        // From the first verse to the end of its surah, in its rewayah.
        const surahUnits = ready.model.unitsOfSurah(units[0].surah);
        store.setUnitRange(units[0], surahUnits[surahUnits.length - 1]);
        store.setVerseRepeatCount(1);
        store.setRangeRepeatCount(1);
      } else if (loop) {
        // @ai-end
        store.setRange(
          {surah: startS, ayah: startA},
          {surah: endS, ayah: endA},
        );
        // One Hafs verse repeats as a verse; several (a range, or one
        // rewayah verse spanning Hafs verses) loop as a range. @ai
        store.setVerseRepeatCount(firstKey !== lastKey ? 1 : 0);
        store.setRangeRepeatCount(0);
      } else {
        const surahInfo = surahData.find((s: {id: number}) => s.id === startS);
        const lastAyah = surahInfo?.verses_count ?? endA;
        store.setRange(
          {surah: startS, ayah: startA},
          {surah: startS, ayah: lastAyah},
        );
        store.setVerseRepeatCount(1);
        store.setRangeRepeatCount(1);
      }

      hideCurrentSheet();
      store.startPlayback(page, units ? units[0] : firstKey); // @ai
    },
    [readySelection, requireSelection, hideSheet, hideCurrentSheet], // @ai
  );

  const handlePlaySelection = useCallback(
    () => startPlaybackForSelection(false),
    [startPlaybackForSelection],
  );

  const handleRepeatSelection = useCallback(
    () => startPlaybackForSelection(true),
    [startPlaybackForSelection],
  );

  const isCurrentTrackTimestamped = useCallback(() => {
    const playerState = usePlayerStore.getState();
    const currentTrack =
      playerState.queue.tracks[playerState.queue.currentIndex];
    const trackRewayatId = currentTrack?.rewayatId;
    if (!trackRewayatId) return false;
    return useTimestampStore.getState().supportedRewayatIds.has(trackRewayatId);
  }, []);

  const handleShowFollowAlong = useCallback(async () => {
    lightHaptics();
    await hideSheet();
    showSheet('follow-along');
  }, [hideSheet]);

  const handlePlayerPlayFromHere = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('played'));
    if (!ready) return;
    const firstKey = selectionPlaybackKeys(ready).firstHafsKey;

    // While the surah's timings or the reciter's verse numbering are still
    // loading, or when the surah has no timing, it failed to load (retried
    // by this request), the numbering cannot be established or the player
    // has moved on to another surah, say so instead of silently keeping the
    // sheet open. A verse of a non-Hafs rewayah starts exactly at itself
    // when the timings are numbered by that rewayah (Warsh 1:7 inside Hafs
    // 1:7); a Hafs selection resolves its first Hafs verse as before.
    const target = resolvePlayFromHere(ready.units ? ready.units[0] : firstKey);
    if (target.status !== 'ready') {
      showToast(
        target.title,
        target.message,
        target.status === 'pending' ? 'none' : 'error',
      );
      return;
    }

    const playerState = usePlayerStore.getState();
    playerState.seekTo(target.entry.timestampFrom / 1000);
    if (playerState.playback.state !== 'playing') {
      playerState.play();
    }
    // Every Hafs verse the reciter verse recites (Warsh 2:1 = Hafs 2:1 + 2:2)
    useTimestampStore.getState().setCurrentAyah(target.tracking);
    // @ai-end

    hideCurrentSheet();
  }, [readySelection, requireSelection, hideCurrentSheet]); // @ai

  const handlePlayerRepeat = useCallback(async () => {
    lightHaptics();
    // @ai-start
    const ready = readySelection ?? (await requireSelection('played'));
    if (!ready) return;
    const firstKey = selectionPlaybackKeys(ready).firstHafsKey;
    // Another rewayah's verse also passes its storage anchor (verse-units
    // contract 4.4: "1:7:1" for Warsh 1:6, "1:7:5" for Warsh 1:7), so the
    // mushaf selects exactly that verse rather than every verse holding Hafs
    // surah:ayah (both Warsh 1:6 and 1:7). surah / ayah stay Hafs; Hafs
    // passes no anchor, as before.
    const anchorKey = ready.units ? ready.anchors[0].key : null;
    // @ai-end
    const [sStr, aStr] = firstKey.split(':');
    const sNum = parseInt(sStr, 10);
    const aNum = parseInt(aStr, 10);

    const playerState = usePlayerStore.getState();
    const currentTrack =
      playerState.queue.tracks[playerState.queue.currentIndex];
    const trackRewayatId = currentTrack?.rewayatId;
    const trackReciterName = currentTrack?.reciterName;

    const mushafStore = useMushafPlayerStore.getState();
    if (trackRewayatId && trackReciterName) {
      mushafStore.setReciter(trackRewayatId, trackReciterName);
    }

    if (playerState.playback.state === 'playing') {
      playerState.pause();
    }

    await hideSheet();
    playerState.setSheetMode('hidden');

    useMushafPlayerStore.setState({pendingStartVerseKey: firstKey});
    // Start at the selected verse itself, in its own rewayah. @ai
    if (ready.units) mushafStore.setPendingStart(ready.units[0]);

    // @ai-start
    // The player can show this sheet before the Mushaf data loads, and a page
    // lookup here then gave an old page or page 1. Open the reader at once with
    // the verse and no page. The reader opens the page of the verse and shows
    // the options when the data is ready (app/mushaf.tsx).
    router.push({
      pathname: '/mushaf',
      params: {
        surah: String(sNum),
        ayah: String(aNum),
        ...(anchorKey !== null ? {anchor: anchorKey} : {}),
        playerOptions: '1',
      },
    });
    // @ai-end
  }, [readySelection, requireSelection, hideSheet]); // @ai

  // @ai-start
  // Root search from Word Study: the root's ayahs in the sheet. Back returns
  // to the word whose root was pressed.
  const handleRootPress = useCallback(
    (root: string, lemma: string | null, word: WordRef) => {
      setWordTarget(word);
      setRootTarget({root, lemma});
      setActiveScreen('root');
    },
    [setActiveScreen],
  );

  // @ai-end

  // @ai-start
  // Back from a screen (the back row and Android's back button): root
  // search returns to Word Study, and Word Study opened by a long-press in
  // Word by Word to Word by Word; any other screen to the verse menu, or,
  // in Word Study only mode (no verse, so no menu), closes the sheet.
  const handleBack = useCallback(() => {
    if (activeScreen === 'root') {
      setActiveScreen('words');
    } else if (activeScreen === 'words' && wordStudyFromWbw) {
      setWordStudyFromWbw(false);
      setActiveScreen('wbw');
    } else if (wordStudyOnly) {
      hideCurrentSheet();
    } else {
      setActiveScreen(null);
    }
  }, [
    activeScreen,
    wordStudyFromWbw,
    wordStudyOnly,
    setActiveScreen,
    hideCurrentSheet,
  ]);
  // Back closes the sheet from the verse menu, and from Word Study in Word
  // Study only mode; anywhere else it steps back a screen.
  const backCloses =
    !activeScreen || (wordStudyOnly && activeScreen === 'words');

  // Android's back button and back gesture. The sheet is a Modal, which
  // takes the back press itself (BackHandler never hears it while the sheet
  // is up) and asks onRequestClose whether to close: a screen steps back
  // instead (false). A swipe or a backdrop tap still closes the sheet from
  // any screen. The library memoizes its back handler without
  // onRequestClose among its dependencies, so it can call an older one:
  // this one never changes and reads the latest render.
  const backRef = useRef({backCloses, handleBack});
  backRef.current = {backCloses, handleBack};
  const handleRequestClose = useCallback((type: CloseRequest) => {
    const {backCloses: closes, handleBack: back} = backRef.current;
    if (type !== BACK_PRESS || closes) return true;
    back();
    return false;
  }, []);
  // @ai-end

  // A hardware keyboard (iPad): the keys that would turn the reader's page
  // or seek the player behind the sheet do nothing while it shows. Word
  // Study, when it is on screen (not while it waits for the selection),
  // binds the arrows itself; its layer may be added before this one.
  const wordStudyShown =
    activeScreen === 'words' &&
    wordStudy !== null &&
    (wordStudyOnly || pendingSelection === null);
  useKeyCommands(NO_KEY_BINDINGS, keyCommandsSupported(), {
    covers: wordStudyShown ? COVERED_KEYS_WORD_STUDY : COVERED_KEYS,
  });

  const handleOnClose = useCallback(() => {
    // @ai-start
    // Word Study only selected no verse and has no menu to return to: the
    // screen stays as it is while the sheet leaves, and a selection another
    // surface made is left alone.
    if (wordStudyOnly) return;
    // @ai-end
    // @ai No LayoutAnimation on close. The sheet library calls onClose in the
    // task that unmounts the sheet's React Native Modal, so an animation
    // configured here also covers that unmount. On iOS (React Native 0.88.1),
    // when "Play from Here" started playback at the same time, the animation
    // lost the removal of the Modal host: UIKit kept the Modal's empty
    // full-screen view on top, and the Mushaf ignored every touch until a
    // restart. Screen changes inside the open sheet still animate.
    setActiveScreenRaw(null);
    useVerseSelectionStore.getState().clearSelection();
    useMushafVerseSelectionStore.getState().clearSelection();
  }, [wordStudyOnly]); // @ai

  const handleDismiss = useCallback(() => {
    hideCurrentSheet();
  }, [hideCurrentSheet]);

  // @ai-start
  // A result tapped in Similar Verses / Shared Phrases opens that verse in
  // the mushaf.
  const handleOpenVerseInReader = useCallback(
    async (targetVerseKey: string, page: number) => {
      // Close first and wait for it. Closing clears the mushaf selection
      // (handleOnClose), about 200 ms later: asked for before that, the
      // reader jumped to the page but the verse it had just lit went dark.
      await hideSheet();
      if (isReaderOpen()) {
        // From the full player, the open reader is under it: close the player
        // too, or the reader jumps and flashes the verse out of sight.
        if (source === 'player') {
          usePlayerStore.getState().setSheetMode('hidden');
        }
        useMushafNavigationStore
          .getState()
          .navigateTo({page, verseKey: targetVerseKey});
        return;
      }
      // No reader is open: the sheet was opened from the audio player. The
      // request went to a store only the reader reads, so the tap did
      // nothing, and the request replayed the next time the reader opened.
      // Open the reader at the verse instead, as the other ways into it do.
      const [surah, ayah] = targetVerseKey.split(':');
      usePlayerStore.getState().setSheetMode('hidden');
      router.push({
        pathname: '/mushaf',
        params: {page: String(page), surah, ayah},
      });
    },
    [hideSheet, source],
  );
  // @ai-end

  // @ai-start
  // In a native sheet the menu, Highlight and Share size the sheet to
  // themselves; the full-screen views, the similar-verse lists and the note
  // (keyboard) take full height.
  const needsFullHeight =
    activeScreen !== null &&
    activeScreen !== 'highlight' &&
    activeScreen !== 'share';
  const nativeKey = nativeLevel?.key;
  useEffect(() => {
    if (nativeKey === undefined) return;
    setNativeSheetDetents(nativeKey, needsFullHeight ? ['large'] : null);
  }, [nativeKey, needsFullHeight]);
  // @ai-end

  if (!payload) return null;

  const isSimilar = activeScreen === 'similar' || activeScreen === 'phrases';
  const isFullScreen =
    activeScreen === 'translation' ||
    activeScreen === 'tafseer' ||
    activeScreen === 'theme' ||
    activeScreen === 'wbw' ||
    activeScreen === 'words' || // @ai
    activeScreen === 'root' || // @ai
    activeScreen === 'community-reflections';

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        activeScreen && {height: windowHeight * SHEET_HEIGHT_FRACTION}, // @ai
      ]}
      indicatorStyle={activeScreen ? {height: 0} : styles.indicator}
      gestureEnabled={true}
      onRequestClose={handleRequestClose} // @ai
      onClose={handleOnClose}>
      <View
        style={[
          styles.container,
          // @ai: in a native sheet the menu scrolls to the screen edge and
          // ends with the inset itself (below); the container adds nothing.
          {paddingBottom: inNativeSheet ? 0 : sheetBottomPadding},
          activeScreen && (!inNativeSheet || needsFullHeight) && {flex: 1},
        ]}>
        {/* @ai-start: Word Study only names no verse: no header, no menu */}
        {!activeScreen && !wordStudyOnly && (
          <View style={styles.header}>
            <Text style={styles.surahName}>{surahName}</Text>
            <Text style={styles.verseRef}>{localizeDigits(verseRefText)}</Text>
          </View>
        )}
        {/* @ai-end */}

        {activeScreen ? (
          <>
            <View style={styles.backRowContainer}>
              <Pressable
                onPress={handleBack}
                accessibilityRole="button" // @ai
                // @ai-start: named by its screen; says so when it closes the sheet
                accessibilityHint={
                  backCloses ? t('common:actions.close') : undefined
                }
                // @ai-end
                style={({pressed}) => [
                  styles.backRow,
                  pressed && {opacity: 0.6},
                ]}
                hitSlop={8}>
                <BackIcon
                  size={moderateScale(16)}
                  color={theme.colors.text}
                  style={flipX}
                />
                <Text style={styles.backRowText}>
                  {t(SCREEN_TITLE_KEYS[activeScreen] ?? 'common:actions.back')}
                </Text>
              </Pressable>
              {(activeScreen === 'translation' ||
                activeScreen === 'tafseer') && (
                <Pressable
                  onPress={() => {
                    lightHaptics();
                    hideCurrentSheet();
                    usePlayerStore.getState().setSheetMode('hidden');
                    setTimeout(() => {
                      router.push('/translations'); // @ai
                    }, 300);
                  }}
                  style={({pressed}) => [
                    styles.settingsButton,
                    pressed && {opacity: 0.6},
                  ]}
                  hitSlop={8}
                  // @ai
                  accessibilityRole="button"
                  accessibilityLabel={t('sheets:verseActions.contentSettings')}>
                  <Feather
                    name="settings"
                    size={moderateScale(16)}
                    color={Color(theme.colors.text).alpha(0.5).toString()}
                  />
                </Pressable>
              )}
            </View>
            {/* @ai-start */}
            {/* Every screen acts on the selected verses; until another
                rewayah's verses can be named, a screen shows why instead
                (never Hafs numbers under that rewayah's name). Hafs is
                always ready. Word Study only studies words no verse holds:
                it never waits for a selection. */}
            {pendingSelection && !wordStudyOnly ? (
              <SelectionPendingView
                selection={pendingSelection}
                theme={theme}
                style={isFullScreen ? {flex: 1} : undefined}
              />
            ) : isFullScreen ? (
              <View style={styles.screenSlot}>
                {/* @ai: the screen fills the slot exactly, whatever its
                    content's height, so its list scrolls and its footer
                    stays on screen (long verses pushed it off before). */}
                <View style={StyleSheet.absoluteFill}>
                  {activeScreen === 'translation' && (
                    <TranslationContent
                      surahNumber={surahNumber}
                      ayahNumber={ayahNumber}
                      rewayah={resolvedRewayah}
                      unitStart={unitStart}
                      onBack={handleBack}
                    />
                  )}
                  {activeScreen === 'tafseer' && (
                    <TafseerContent
                      surahNumber={surahNumber}
                      ayahNumber={ayahNumber}
                      rewayah={resolvedRewayah}
                      unitStart={unitStart}
                      onBack={handleBack}
                    />
                  )}
                  {activeScreen === 'theme' && (
                    <ThemeContent
                      surahNumber={surahNumber}
                      ayahNumber={ayahNumber}
                      unitStart={unitStart}
                      onBack={handleBack}
                    />
                  )}
                  {activeScreen === 'wbw' && (
                    <WBWContent
                      surahNumber={surahNumber}
                      ayahNumber={ayahNumber}
                      rewayah={resolvedRewayah}
                      unitStart={unitStart}
                      onOpenWord={handleOpenWord} // @ai
                      onBack={handleBack}
                    />
                  )}
                  {/* @ai-start */}
                  {/* The selected verses' words, in the sheet's rewayah
                    (another rewayah steps through its Hafs words), or Word
                    Study only's words. A root opens root search below. */}
                  {activeScreen === 'words' && wordStudy && (
                    <WordStudyContent
                      study={wordStudy}
                      initialWord={wordTarget}
                      onRootPress={handleRootPress}
                    />
                  )}
                  {activeScreen === 'root' && rootTarget && (
                    <RootSearchContent
                      sheetId={props.sheetId}
                      root={rootTarget.root}
                      initialLemma={rootTarget.lemma ?? undefined}
                      rewayah={resolvedRewayah}
                    />
                  )}
                  {/* @ai-end */}
                  {activeScreen === 'community-reflections' &&
                    readySelection && (
                      // Reflections are per Hafs verse: the one holding the
                      // verse's first word; the badge is the verse's own label.
                      <CommunityReflectionsContent
                        surahNumber={readySelection.linkVerse.surah}
                        ayahNumber={readySelection.linkVerse.ayah}
                        label={
                          readySelection.units
                            ? readySelection.label
                            : undefined
                        }
                      />
                    )}
                </View>
              </View>
            ) : readySelection ? (
              <>
                {activeScreen === 'highlight' && (
                  <HighlightContent
                    selection={readySelection}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'note' && (
                  <NoteContent
                    selection={readySelection}
                    onDone={handleDismiss}
                  />
                )}
                {activeScreen === 'share' && (
                  <ShareContent
                    verseKey={verseKey}
                    surahNumber={surahNumber}
                    ayahNumber={ayahNumber}
                    verseKeys={verseKeys}
                    unitKeys={
                      readySelection.units ? readySelection.keys : undefined
                    }
                    rewayah={resolvedRewayah}
                    onDone={handleDismiss}
                  />
                )}
                {isSimilar && qulKey && (
                  // @ai: in a native sheet it fills its slot exactly, as the
                  // full screens do
                  <View style={inNativeSheet ? styles.screenSlot : undefined}>
                    <View
                      style={
                        inNativeSheet ? StyleSheet.absoluteFill : undefined
                      }>
                      <SimilarVersesContent
                        verseKey={qulKey}
                        surahNumber={surahNumber}
                        ayahNumber={ayahNumber}
                        section={
                          activeScreen === 'similar' ? 'similar' : 'phrases'
                        }
                        rewayah={resolvedRewayah} // @ai
                        onDone={handleDismiss}
                        hafsReferences={resolvedRewayah !== 'hafs'}
                        onOpenVerse={handleOpenVerseInReader}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : null}
            {/* @ai-end */}
          </>
        ) : wordStudyOnly ? null /* @ai — never the verse menu */ : (
          <SheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom:
                moderateScale(10) + (inNativeSheet ? sheetBottomPadding : 0),
            }}>
            {/* LISTEN */}
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={
                  source === 'player'
                    ? isCurrentTrackTimestamped()
                      ? handlePlayerPlayFromHere
                      : handleShowFollowAlong
                    : handlePlaySelection
                }>
                <PlayIcon size={moderateScale(18)} color={theme.colors.text} />
                <Text style={styles.optionText}>
                  {isRange
                    ? t('verseActions.playSelection')
                    : t('verseActions.playFromHere')}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={
                  source === 'player'
                    ? isCurrentTrackTimestamped()
                      ? handlePlayerRepeat
                      : handleShowFollowAlong
                    : handleRepeatSelection
                }>
                <RepeatIcon
                  size={moderateScale(24)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {t('verseActions.repeat')}
                </Text>
              </Pressable>
            </View>

            {/* STUDY */}
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleToggleBookmark}>
                <Feather
                  name={isBookmarked ? 'minus-circle' : 'bookmark'}
                  size={moderateScale(18)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {isBookmarked
                    ? t('verseActions.removeBookmark')
                    : t('verseActions.bookmark')}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleHighlight}>
                {isHighlighted ? (
                  <Feather
                    name="minus-circle"
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                ) : (
                  <HighlightIcon
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                )}
                <Text style={styles.optionText}>
                  {isHighlighted
                    ? t('highlight.remove')
                    : t('verseActions.highlight')}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleNote}>
                <PageQuillIcon
                  size={moderateScale(18)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {t('verseActions.addNote')}
                </Text>
              </Pressable>
            </View>

            {/* EXPLORE */}
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleTranslation}>
                <MaterialCommunityIcons
                  name="translate"
                  size={moderateScale(19)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {t('verseActions.translation')}
                </Text>
              </Pressable>
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleTafseer}>
                    <StackedVolumesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.tafseer')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleTheme}>
                    <GroupedLinesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.theme')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {!isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleWBW}>
                    <BreakdownIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.wordByWord')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {/* @ai-start */}
              {/* Word Study (was I'rab): one verse or several. After Word by
                  Word for one verse; second, after Translation, for a range. */}
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                style={[styles.option]}
                onPress={handleWordStudy}>
                <MaterialCommunityIcons
                  name="file-tree-outline"
                  size={moderateScale(18)}
                  color={theme.colors.text}
                />
                <Text style={styles.optionText}>
                  {t('verseActions.wordStudy')}
                </Text>
              </Pressable>
              {/* @ai-end */}
              {/* RFC-018 — Community Reflections row. Gated on a fork wiring
                  branding.communityReflectionsProvider (so Bayaan never shows
                  it) and single-ayah selection. Same predicate as the inline
                  slot + settings toggle; no new seam. */}
              {branding.communityReflectionsProvider && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleCommunityReflections}>
                    <MaterialCommunityIcons
                      name="comment-quote-outline"
                      size={moderateScale(19)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.communityReflections')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {hasSimilarVerses && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleSimilarVerses}>
                    <MirrorWavesIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.similarVerses')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              {hasSharedPhrases && !isRange ? (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityRole="button" // @ai
                    style={[styles.option]}
                    onPress={handleSharedPhrases}>
                    <ChainLinksIcon
                      size={moderateScale(18)}
                      color={theme.colors.text}
                    />
                    <Text style={styles.optionText}>
                      {t('verseActions.sharedPhrases')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            {/* SHARE */}
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleCopy}
                // @ai-start
                disabled={isCopying}
                accessibilityState={{busy: isCopying}}>
                {isCopying ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.text}
                    style={{width: moderateScale(18)}}
                  />
                ) : (
                  <CopyIcon
                    size={moderateScale(18)}
                    color={theme.colors.text}
                  />
                )}
                {/* @ai-end */}
                <Text style={styles.optionText}>
                  {t('common:actions.copy')}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button" // @ai
                style={[styles.option]}
                onPress={handleShare}>
                <ShareIcon size={moderateScale(18)} color={theme.colors.text} />
                <Text style={styles.optionText}>
                  {t('common:actions.share')}
                </Text>
              </Pressable>
            </View>
          </SheetScrollView>
        )}
      </View>
    </ActionSheet>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    screenSlot: {flex: 1}, // @ai
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(30),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(14),
      gap: moderateScale(2),
    },
    surahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseRef: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textTertiary,
      textAlign: 'center',
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(10),
    },
    backRowContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: moderateScale(10),
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(2),
    },
    settingsButton: {
      padding: moderateScale(4),
    },
    backRowText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
  });
