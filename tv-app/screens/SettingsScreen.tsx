import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {
  FocusText,
  useButtonFocused,
} from '../components/primitives/focusContext';
import {SidePanel, type PanelSection} from '../components/listening/SidePanel';
import {VersePreview} from '../components/settings/VersePreview';
import {ReciterPickerPanel} from '../components/settings/ReciterPickerPanel';
import {formatSpeed} from '../components/listening/ListeningPanels';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {useFavorites} from '../hooks/useFavorites';
import {useLovedSurahs} from '../hooks/useLovedSurahs';
import {clearContinue} from '../services/continueListeningStore';
import {clearRecent} from '../services/recentlyPlayedStore';
import {clearFavorites} from '../services/favoritesStore';
import {clearLovedSurahs} from '../services/lovedSurahsStore';
import {AMBIENT_AVAILABLE} from '../services/ambientPlayer';
import {defaultReciterChoices} from '../services/reciterPicker';
import {getDefaultReciter} from '../services/tvDataService';
import {resetOnboarded, useOnboardingStore} from '../hooks/useOnboarded';
import {
  DISPLAY_PICKERS,
  resolveDefaultReciter,
  useSettingsStore,
  type SettingsPicker,
  type SettingsRow,
} from '../store/settingsStore';
import {
  DIM_CHOICES,
  dimLabel,
  findTranslation,
  ON_SCREEN_MODES,
  TEXT_SIZES,
  TRANSLATIONS,
  useDisplayStore,
} from '../store/displayStore';
import {
  AMBIENT_SOUND_OPTIONS,
  ambientChoiceLabel,
  useAmbientStore,
  type AmbientChoice,
} from '../store/ambientStore';
import {useOverlayStore} from '../store/overlayStore';
import {SPEED_CYCLE} from '../store/listeningStore';
import type {Reciter} from '../types/reciter';
import appConfig from '../app.json';
import {colors} from '../theme/colors';
import {SCREEN_GUTTER, spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

type ConfirmKey = 'history' | 'favorites' | null;

/** An armed clear row disarms itself after this long. */
const ARM_MS = 5000;
/** The armed warning: a dark red on the cream focus fill, a soft one at rest. */
const WARN_ON_FOCUS = '#8a1f1f';
const WARN_AT_REST = '#e8a598';

function countLabel(count: number): string {
  if (count === 0) return 'Nothing saved';
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/**
 * Settings as grouped rows, each with its current value on the right, beside
 * a live preview of a verse with the current On screen choices. A row with
 * choices opens a picker beside the list; for what shows on screen, the
 * preview moves next to the picker so each choice is seen as it is made.
 * Back closes the picker and focus returns to its row.
 */
export function SettingsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const picker = useSettingsStore(s => s.picker);
  const setPicker = useSettingsStore(s => s.setPicker);
  const focusRow = useSettingsStore(s => s.focusRow);
  const setFocusRow = useSettingsStore(s => s.setFocusRow);
  const mode = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);
  const textSize = useDisplayStore(s => s.textSize);
  const dimAfterMin = useDisplayStore(s => s.dimAfterMin);
  const speed = useOverlayStore(s => s.speed);
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const continueEntries = useContinueListening();
  const recent = useRecentlyPlayed();
  const favorites = useFavorites();
  const loved = useLovedSurahs();
  // The voice that actually plays: the saved pick, or the same fallback
  // playback uses when it is unset or no longer in the catalog.
  // (defaultReciterId above re-renders this when the pick changes.)
  const current =
    resolveDefaultReciter(reciters, getDefaultReciter) ?? undefined;
  const [confirm, setConfirm] = useState<ConfirmKey>(null);

  // An armed clear does not wait forever for its second press.
  useEffect(() => {
    if (confirm === null) return;
    const timer = setTimeout(() => setConfirm(null), ARM_MS);
    return () => clearTimeout(timer);
  }, [confirm]);

  // Leaving Settings closes its picker and forgets the focused row, except
  // while the welcome it opened is showing: focus comes back to that row.
  useEffect(
    () => () => {
      setPicker(null);
      if (useOnboardingStore.getState().onboarded) setFocusRow(null);
    },
    [setPicker, setFocusRow],
  );

  const historyCount = continueEntries.length + recent.length;
  const favoritesCount = favorites.length + loved.length;

  function runClear(key: Exclude<ConfirmKey, null>): void {
    setFocusRow(key);
    // Nothing saved: there is nothing to confirm.
    if ((key === 'history' ? historyCount : favoritesCount) === 0) return;
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    if (key === 'history') {
      clearContinue();
      clearRecent();
    } else {
      clearFavorites();
      clearLovedSurahs();
    }
    setConfirm(null);
  }

  // When the rows show again, focus goes back to the row last used. The
  // store sets it in the same update that opens a picker, so no other row
  // is asked for focus first.
  const listRef = useRef<ScrollView>(null);
  const focusOn = (key: SettingsRow): boolean =>
    picker === null && (focusRow ?? 'reciter') === key;

  const row = (key: SettingsPicker) => ({
    active: picker === key,
    hasTVPreferredFocus: focusOn(key),
    onPress: () => {
      setConfirm(null);
      setPicker(key);
    },
  });

  const displayPicker = picker !== null && DISPLAY_PICKERS.includes(picker);
  // Stable, so the reciter list does not re-render on every progress save.
  const closePicker = useCallback(() => setPicker(null), [setPicker]);
  const disarm = (key: Exclude<ConfirmKey, null>) => () =>
    setConfirm(c => (c === key ? null : c));

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Settings</Text>
      {displayPicker ? (
        // The rows step aside so the preview sits beside the picker.
        <View style={styles.besidePicker}>
          <Text style={styles.previewLabel}>Preview</Text>
          <VersePreview large />
          <Text style={styles.previewNote}>
            Select a choice again, or press Back, when you are done.
          </Text>
        </View>
      ) : (
        <View style={styles.columns}>
          <ScrollView
            ref={listRef}
            onContentSizeChange={() => {
              // Coming back from the welcome rerun, the row that opened it is
              // the last one: put it on screen so its preferred focus can land
              // (it showed no focus at all on Android TV before).
              if (focusRow === 'welcome' && picker === null) {
                listRef.current?.scrollToEnd({animated: false});
              }
            }}
            style={styles.listScroll}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            <TVFocusGuideView autoFocus style={styles.list}>
              <Text style={styles.group}>Listening</Text>
              <Row
                label="Default reciter"
                value={current?.name ?? 'Choose'}
                {...row('reciter')}
              />
              <Row
                label="Default speed"
                value={formatSpeed(speed)}
                {...row('speed')}
              />
              {AMBIENT_AVAILABLE ? (
                <Row
                  label="Background sound"
                  value={ambientChoiceLabel(ambientOn ? ambientSound : 'off')}
                  {...row('sound')}
                />
              ) : null}

              <Text style={styles.group}>On screen</Text>
              <Row
                label="Text"
                value={ON_SCREEN_MODES.find(m => m.value === mode)?.label ?? ''}
                {...row('mode')}
              />
              <Row
                label="Translation"
                value={findTranslation(edition).name}
                {...row('translation')}
              />
              <Row
                label="Text size"
                value={
                  TEXT_SIZES.find(s => s.value === textSize)?.label ?? 'Large'
                }
                {...row('textSize')}
              />
              <Row
                label="Dim when idle"
                value={dimLabel(dimAfterMin)}
                {...row('dim')}
              />

              <Text style={styles.group}>Your data</Text>
              <Row
                label="Clear listening history"
                value={
                  confirm === 'history'
                    ? 'Press again to clear'
                    : countLabel(historyCount)
                }
                warn={confirm === 'history'}
                hasTVPreferredFocus={focusOn('history')}
                onPress={() => runClear('history')}
                onBlur={disarm('history')}
              />
              <Row
                label="Clear favourites"
                value={
                  confirm === 'favorites'
                    ? 'Press again to clear'
                    : countLabel(favoritesCount)
                }
                warn={confirm === 'favorites'}
                hasTVPreferredFocus={focusOn('favorites')}
                onPress={() => runClear('favorites')}
                onBlur={disarm('favorites')}
              />

              <Text style={styles.group}>Welcome</Text>
              <Row
                label="Show welcome again"
                value="Reciter and display"
                hasTVPreferredFocus={focusOn('welcome')}
                onPress={() => {
                  setConfirm(null);
                  setFocusRow('welcome');
                  resetOnboarded();
                }}
              />
            </TVFocusGuideView>
          </ScrollView>
          <View style={styles.previewColumn}>
            <Text style={styles.previewLabel}>Preview</Text>
            <VersePreview />
            <Text style={styles.previewNote}>
              How verses show while you listen. Text, Translation and Text size
              change it.
            </Text>
            <Text style={styles.version}>
              Bayaan TV {appConfig.expo.version}
            </Text>
          </View>
        </View>
      )}
      {picker ? (
        <SettingsPickerPanel
          picker={picker}
          reciters={reciters}
          current={current}
          onDone={closePicker}
        />
      ) : null}
    </View>
  );
}

function SettingsPickerPanel({
  picker,
  reciters,
  current,
  onDone,
}: {
  picker: SettingsPicker;
  reciters: Reciter[];
  current: Reciter | undefined;
  onDone: () => void;
}): React.ReactElement {
  const setDefaultReciterId = useSettingsStore(s => s.setDefaultReciterId);
  const mode = useDisplayStore(s => s.mode);
  const setMode = useDisplayStore(s => s.setMode);
  const edition = useDisplayStore(s => s.edition);
  const setEdition = useDisplayStore(s => s.setEdition);
  const textSize = useDisplayStore(s => s.textSize);
  const setTextSize = useDisplayStore(s => s.setTextSize);
  const dimAfterMin = useDisplayStore(s => s.dimAfterMin);
  const setDimAfter = useDisplayStore(s => s.setDimAfter);
  const speed = useOverlayStore(s => s.speed);
  const applySpeed = useOverlayStore(s => s.applySpeed);
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const chooseAmbient = useAmbientStore(s => s.choose);
  // Settings re-renders while audio plays (continue-listening saves), so the
  // 200+ reciter list is built once per open, not on every render.
  const currentId = current?.id ?? null;
  const reciterChoices = useMemo(
    () =>
      picker === 'reciter' ? defaultReciterChoices(reciters, currentId) : [],
    [picker, reciters, currentId],
  );
  const pickReciter = useCallback(
    (id: string) => {
      setDefaultReciterId(id);
      onDone();
    },
    [setDefaultReciterId, onDone],
  );

  let title: string;
  let section: PanelSection<any>;
  switch (picker) {
    case 'reciter':
      return (
        <ReciterPickerPanel
          title="Default reciter"
          subtitle="Plays when you pick a surah"
          reciters={reciterChoices}
          selectedId={currentId}
          onSelect={pickReciter}
        />
      );
    case 'speed':
      title = 'Default speed';
      section = {
        title: 'Every recitation plays at',
        options: SPEED_CYCLE.map(s => ({value: s, label: formatSpeed(s)})),
        selected: speed,
        onSelect: (rate: number) => {
          applySpeed(rate);
          onDone();
        },
      };
      break;
    case 'sound':
      title = 'Background sound';
      section = {
        title: 'Plays softly under the recitation',
        options: [{value: 'off', label: 'Off'}, ...AMBIENT_SOUND_OPTIONS],
        selected: (ambientOn ? ambientSound : 'off') as AmbientChoice,
        onSelect: (choice: AmbientChoice) => {
          chooseAmbient(choice);
          onDone();
        },
      };
      break;
    case 'mode':
      title = 'Text';
      section = {
        title: 'Show while listening',
        options: ON_SCREEN_MODES,
        selected: mode,
        onSelect: again(mode, setMode, onDone),
      };
      break;
    case 'translation':
      title = 'Translation';
      section = {
        title: 'Shown under the verse',
        options: TRANSLATIONS.map(t => ({
          value: t.id,
          label: t.name,
          detail: t.language,
        })),
        selected: edition,
        onSelect: again(edition, setEdition, onDone),
      };
      break;
    case 'textSize':
      title = 'Text size';
      section = {
        title: 'In the listening room',
        options: TEXT_SIZES,
        selected: textSize,
        onSelect: again(textSize, setTextSize, onDone),
      };
      break;
    case 'dim':
      title = 'Dim when idle';
      section = {
        title: 'Darken the listening room after',
        options: DIM_CHOICES.map(m => ({value: m, label: dimLabel(m)})),
        selected: dimAfterMin,
        onSelect: (minutes: number) => {
          setDimAfter(minutes);
          onDone();
        },
      };
      break;
  }
  return <SidePanel title={title} sections={[section]} onActivity={noop} />;
}

function noop(): void {}

/**
 * For the display pickers, which stay open so each choice previews live:
 * choosing the option already selected closes the picker, like the others.
 */
function again<T>(
  selected: T,
  choose: (value: T) => void,
  done: () => void,
): (value: T) => void {
  return value => (Object.is(value, selected) ? done() : choose(value));
}

/** Calls `onBlur` when the button around it loses focus. */
function BlurWatch({onBlur}: {onBlur: () => void}): null {
  const focused = useButtonFocused();
  const was = useRef(focused);
  useEffect(() => {
    if (was.current && !focused) onBlur();
    was.current = focused;
  }, [focused, onBlur]);
  return null;
}

function Row({
  label,
  value,
  warn,
  active,
  onPress,
  onBlur,
  hasTVPreferredFocus,
}: {
  label: string;
  value: string;
  /** The value is a warning (a destructive press is armed). */
  warn?: boolean;
  /** Its picker is open. */
  active?: boolean;
  onPress: () => void;
  /** Focus left the row (an armed clear disarms). */
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      style={[styles.row, active && styles.rowActive]}>
      {onBlur ? <BlurWatch onBlur={onBlur} /> : null}
      <FocusText style={styles.rowLabel} numberOfLines={1}>
        {label}
      </FocusText>
      <FocusText
        style={styles.rowValue}
        color={warn ? WARN_AT_REST : colors.textSecondary}
        focusedColor={warn ? WARN_ON_FOCUS : colors.onFocusSecondary}
        numberOfLines={1}>
        {value}
      </FocusText>
    </FocusableButton>
  );
}

const ROW_PAD = 28;
const LIST_W = 760;

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    // Lines up with the rows' edge, like every root screen's title.
    paddingLeft: SCREEN_GUTTER,
  },
  columns: {flex: 1, flexDirection: 'row', gap: spacing.xl},
  listScroll: {width: LIST_W + spacing.xl, flexGrow: 0},
  scroll: {paddingLeft: spacing.xl, paddingBottom: spacing.xxl},
  list: {gap: 8},
  group: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 32,
    marginBottom: 6,
    paddingLeft: ROW_PAD,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    paddingHorizontal: ROW_PAD,
    paddingVertical: 18,
    borderRadius: 16,
    // Ink & Cream: nothing behind a row at rest; the outline is kept clear so
    // the row whose picker is open can show one without shifting.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowActive: {borderColor: colors.outline},
  rowLabel: {
    flexShrink: 0,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 23,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  previewColumn: {flex: 1, paddingTop: 32, paddingRight: spacing.xl, gap: 14},
  previewLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  previewNote: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 24,
  },
  version: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 15,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  // Left of the 620-wide picker panel.
  besidePicker: {
    position: 'absolute',
    left: spacing.xl,
    right: 620 + spacing.xl,
    top: 180,
    gap: 14,
  },
});
