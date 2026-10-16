import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {SidePanel, type PanelSection} from '../components/listening/SidePanel';
import {VersePreview} from '../components/settings/VersePreview';
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
import {getReciterArtwork} from '../services/reciterArtwork';
import {AMBIENT_AVAILABLE} from '../services/ambientPlayer';
import {
  DISPLAY_PICKERS,
  useSettingsStore,
  type SettingsPicker,
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
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

type ConfirmKey = 'history' | 'favorites' | null;

/** Reciters offered in the picker: the current one first, then the catalog. */
const PICKER_RECITERS = 40;

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
  const current = reciters.find(r => r.id === defaultReciterId);
  const [confirm, setConfirm] = useState<ConfirmKey>(null);

  // When a picker closes, focus goes back to the row that opened it.
  const [returnTo, setReturnTo] = useState<SettingsPicker | null>(null);
  const lastPicker = useRef<SettingsPicker | null>(null);
  useEffect(() => {
    if (picker === null && lastPicker.current !== null) {
      setReturnTo(lastPicker.current);
    }
    lastPicker.current = picker;
  }, [picker]);

  // Leaving Settings closes its picker.
  useEffect(() => () => setPicker(null), [setPicker]);

  function runClear(key: Exclude<ConfirmKey, null>): void {
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

  const row = (key: SettingsPicker) => ({
    active: picker === key,
    hasTVPreferredFocus:
      picker === null &&
      (returnTo === null ? key === 'reciter' : returnTo === key),
    onPress: () => {
      setConfirm(null);
      setPicker(key);
    },
  });

  const displayPicker = picker !== null && DISPLAY_PICKERS.includes(picker);
  const historyCount = continueEntries.length + recent.length;
  const favoritesCount = favorites.length + loved.length;

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Settings</Text>
      {displayPicker ? (
        // The rows step aside so the preview sits beside the picker.
        <View style={styles.besidePicker}>
          <Text style={styles.previewLabel}>Preview</Text>
          <VersePreview large />
        </View>
      ) : (
        <View style={styles.columns}>
          <ScrollView
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
                onPress={() => runClear('history')}
              />
              <Row
                label="Clear favorites"
                value={
                  confirm === 'favorites'
                    ? 'Press again to clear'
                    : countLabel(favoritesCount)
                }
                warn={confirm === 'favorites'}
                onPress={() => runClear('favorites')}
              />
            </TVFocusGuideView>

            <Text style={styles.group}>About</Text>
            <View style={styles.staticRow}>
              <Text style={styles.staticLabel}>Bayaan TV</Text>
              <Text style={styles.staticValue}>{appConfig.expo.version}</Text>
            </View>
          </ScrollView>
          <View style={styles.previewColumn}>
            <Text style={styles.previewLabel}>Preview</Text>
            <VersePreview />
            <Text style={styles.previewNote}>
              How verses show while you listen. Text, Translation and Text size
              change it.
            </Text>
          </View>
        </View>
      )}
      {picker ? (
        <SettingsPickerPanel
          picker={picker}
          reciters={reciters}
          current={current}
          onDone={() => setPicker(null)}
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

  let title: string;
  let section: PanelSection<any>;
  switch (picker) {
    case 'reciter': {
      const list = [
        ...(current ? [current] : []),
        ...reciters.filter(r => r.id !== current?.id),
      ].slice(0, PICKER_RECITERS);
      title = 'Default reciter';
      section = {
        title: 'Plays when you pick a surah',
        options: list.map(r => ({
          value: r.id,
          label: r.name,
          face: {source: getReciterArtwork(r), name: r.name},
        })),
        selected: current?.id ?? null,
        onSelect: (id: string) => {
          setDefaultReciterId(id);
          onDone();
        },
      };
      break;
    }
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
        onSelect: setMode,
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
        onSelect: setEdition,
      };
      break;
    case 'textSize':
      title = 'Text size';
      section = {
        title: 'In the listening room',
        options: TEXT_SIZES,
        selected: textSize,
        onSelect: setTextSize,
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

function Row({
  label,
  value,
  warn,
  active,
  onPress,
  hasTVPreferredFocus,
}: {
  label: string;
  value: string;
  /** The value is a warning (a destructive press is armed). */
  warn?: boolean;
  /** Its picker is open. */
  active?: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={`${label}: ${value}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      style={[styles.row, active && styles.rowActive]}>
      <FocusText style={styles.rowLabel} numberOfLines={1}>
        {label}
      </FocusText>
      <FocusText
        style={styles.rowValue}
        color={warn ? colors.accent : colors.textSecondary}
        focusedColor={colors.onFocusSecondary}
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
    paddingLeft: spacing.xl + ROW_PAD,
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
    backgroundColor: 'rgba(244,243,236,0.05)',
  },
  rowActive: {backgroundColor: 'rgba(244,243,236,0.12)'},
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
  staticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ROW_PAD,
    paddingVertical: 18,
  },
  staticLabel: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 23,
  },
  staticValue: {
    color: colors.textSecondary,
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
  // Left of the 620-wide picker panel.
  besidePicker: {
    position: 'absolute',
    left: spacing.xl,
    right: 620 + spacing.xl,
    top: 180,
    gap: 14,
  },
});
