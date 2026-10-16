import React, {useEffect, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {SidePanel, type PanelSection} from '../components/listening/SidePanel';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useFavorites} from '../hooks/useFavorites';
import {clearContinue} from '../services/continueListeningStore';
import {clearFavorites} from '../services/favoritesStore';
import {getReciterArtwork} from '../services/reciterArtwork';
import {useSettingsStore, type SettingsPicker} from '../store/settingsStore';
import {
  findTranslation,
  TEXT_SIZES,
  TRANSLATIONS,
  useDisplayStore,
} from '../store/displayStore';
import type {Reciter} from '../types/reciter';
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
 * Settings as one list of rows, each with its current value on the right.
 * Rows with choices open a picker beside the list (reciters with their faces),
 * so the list stays put and Back closes the picker.
 */
export function SettingsScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const defaultReciterId = useSettingsStore(s => s.defaultReciterId);
  const picker = useSettingsStore(s => s.picker);
  const setPicker = useSettingsStore(s => s.setPicker);
  const edition = useDisplayStore(s => s.edition);
  const textSize = useDisplayStore(s => s.textSize);
  const continueEntries = useContinueListening();
  const favorites = useFavorites();
  const current = reciters.find(r => r.id === defaultReciterId);
  const [confirm, setConfirm] = useState<ConfirmKey>(null);

  // Leaving Settings closes its picker.
  useEffect(() => () => setPicker(null), [setPicker]);

  function runClear(key: Exclude<ConfirmKey, null>): void {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    if (key === 'history') clearContinue();
    else clearFavorites();
    setConfirm(null);
  }

  const open = (key: SettingsPicker) => () => {
    setConfirm(null);
    setPicker(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>
        <TVFocusGuideView autoFocus style={styles.list}>
          <Text style={styles.group}>Listening</Text>
          <Row
            label="Default reciter"
            value={current?.name ?? 'Choose'}
            chevron
            active={picker === 'reciter'}
            onPress={open('reciter')}
            hasTVPreferredFocus
          />
          <Row
            label="Translation"
            value={findTranslation(edition).name}
            chevron
            active={picker === 'translation'}
            onPress={open('translation')}
          />
          <Row
            label="Verse text size"
            value={TEXT_SIZES.find(s => s.value === textSize)?.label ?? 'Large'}
            chevron
            active={picker === 'textSize'}
            onPress={open('textSize')}
          />

          <Text style={styles.group}>Your data</Text>
          <Row
            label="Clear listening history"
            value={
              confirm === 'history'
                ? 'Press again to clear'
                : countLabel(continueEntries.length)
            }
            warn={confirm === 'history'}
            onPress={() => runClear('history')}
          />
          <Row
            label="Clear favorites"
            value={
              confirm === 'favorites'
                ? 'Press again to clear'
                : countLabel(favorites.length)
            }
            warn={confirm === 'favorites'}
            onPress={() => runClear('favorites')}
          />
        </TVFocusGuideView>

        <Text style={styles.group}>About</Text>
        <View style={styles.staticRow}>
          <Text style={styles.staticLabel}>Bayaan TV</Text>
          <Text style={styles.staticValue}>0.1.0</Text>
        </View>
      </ScrollView>
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
  const edition = useDisplayStore(s => s.edition);
  const setEdition = useDisplayStore(s => s.setEdition);
  const textSize = useDisplayStore(s => s.textSize);
  const setTextSize = useDisplayStore(s => s.setTextSize);

  let title: string;
  let section: PanelSection<any>;
  if (picker === 'reciter') {
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
  } else if (picker === 'translation') {
    title = 'Translation';
    section = {
      title: 'Shown under the verse',
      options: TRANSLATIONS.map(t => ({
        value: t.id,
        label: t.name,
        detail: t.language,
      })),
      selected: edition,
      onSelect: (id: string) => {
        setEdition(id);
        onDone();
      },
    };
  } else {
    title = 'Verse text size';
    section = {
      title: 'In the player',
      options: TEXT_SIZES,
      selected: textSize,
      onSelect: v => {
        setTextSize(v);
        onDone();
      },
    };
  }
  return <SidePanel title={title} sections={[section]} onActivity={noop} />;
}

function noop(): void {}

function Row({
  label,
  value,
  chevron,
  warn,
  active,
  onPress,
  hasTVPreferredFocus,
}: {
  label: string;
  value: string;
  chevron?: boolean;
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
      <View style={styles.rowValueWrap}>
        <FocusText
          style={styles.rowValue}
          color={warn ? colors.accent : colors.textSecondary}
          focusedColor={colors.onFocusSecondary}
          numberOfLines={1}>
          {value}
        </FocusText>
        {chevron ? (
          <FocusText
            style={styles.chevron}
            color={colors.textTertiary}
            focusedColor={colors.onFocusSecondary}>
            ›
          </FocusText>
        ) : null}
      </View>
    </FocusableButton>
  );
}

const ROW_PAD = 28;

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingLeft: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    width: 900 + spacing.xl,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
    paddingLeft: ROW_PAD,
  },
  list: {gap: 4},
  group: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 36,
    marginBottom: 8,
    paddingLeft: ROW_PAD,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    paddingHorizontal: ROW_PAD,
    paddingVertical: 20,
    borderRadius: 16,
  },
  rowActive: {backgroundColor: 'rgba(244,243,236,0.08)'},
  rowLabel: {
    flexShrink: 0,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 24,
  },
  rowValueWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 22,
  },
  chevron: {fontSize: 32, lineHeight: 34, fontWeight: '300'},
  staticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ROW_PAD,
    paddingVertical: 20,
  },
  staticLabel: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 24,
  },
  staticValue: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 22,
  },
});
