import React, {useEffect, useState} from 'react';
import {TVFocusGuideView, View} from 'react-native';
import {FocusableButton, FocusText} from '../primitives/FocusableButton';
import {
  keyRows,
  modeKeyLabel,
  type KeyboardMode,
} from '../../services/search/keyboard';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  mode: KeyboardMode;
  onKey: (key: string) => void;
  onSpace: () => void;
  onDelete: () => void;
  onClear: () => void;
  onMode: () => void;
  /** Focus the first key when the screen opens. */
  preferFirstKey: boolean;
  /**
   * Pull focus to the last key used (the first key before any). Set it for a
   * moment when focus has to come back to the keyboard on purpose: after Back
   * from the results, or when the focused row under it goes away.
   */
  focusLastKey?: boolean;
};

/**
 * The on-screen grid keyboard: 7 x 4 keys plus space, delete, clear and the
 * mode key. Keys are keyed by position, so a key keeps focus while the mode
 * changes its label. The guide brings focus back to the last key used when
 * it returns from the results; `focusLastKey` does the same on request.
 */
export function SearchKeyboard({
  mode,
  onKey,
  onSpace,
  onDelete,
  onClear,
  onMode,
  preferFirstKey,
  focusLastKey = false,
}: Props): React.ReactElement {
  const [lastKey, setLastKey] = useState(FIRST_KEY);
  // The first key's arrival preference is let go once it has done its job,
  // so a later request for that same key is a real false-to-true change the
  // focus engine acts on.
  const [arriving, setArriving] = useState(preferFirstKey);
  useEffect(() => {
    if (!arriving) return;
    const t = setTimeout(() => setArriving(false), ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [arriving]);
  const rows = keyRows(mode);
  const arabic = mode === 'arabic';
  const press = (id: string, action: () => void) => () => {
    setLastKey(id);
    action();
  };
  const wanted = (id: string): boolean => focusLastKey && lastKey === id;
  return (
    <TVFocusGuideView autoFocus style={styles.grid}>
      {rows.map((row, r) => (
        <View key={`row-${r}`} style={styles.row}>
          {row.map((key, c) =>
            key ? (
              <FocusableButton
                key={`k-${r}-${c}`}
                onPress={press(`k-${r}-${c}`, () => onKey(key))}
                hasTVPreferredFocus={
                  (arriving && r === 0 && c === 0) || wanted(`k-${r}-${c}`)
                }
                accessibilityLabel={key}
                focusScale={1.08}
                style={styles.key}>
                <FocusText style={[styles.keyText, arabic && styles.arabic]}>
                  {key}
                </FocusText>
              </FocusableButton>
            ) : (
              <View key={`k-${r}-${c}`} style={styles.key} />
            ),
          )}
        </View>
      ))}
      <View style={styles.row}>
        <WideKey
          label="space"
          onPress={press('space', onSpace)}
          focus={wanted('space')}
        />
        <WideKey
          label="delete"
          onPress={press('delete', onDelete)}
          focus={wanted('delete')}
        />
        <WideKey
          label="clear"
          onPress={press('clear', onClear)}
          focus={wanted('clear')}
        />
        <WideKey
          label={modeKeyLabel(mode)}
          onPress={press('mode', onMode)}
          focus={wanted('mode')}
          accessibilityLabel="Switch keyboard"
        />
      </View>
    </TVFocusGuideView>
  );
}

function WideKey({
  label,
  onPress,
  focus,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  focus: boolean;
  accessibilityLabel?: string;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      hasTVPreferredFocus={focus}
      accessibilityLabel={accessibilityLabel ?? label}
      containerStyle={styles.wideWrap}
      style={styles.wide}>
      <FocusText style={styles.wideText} color={colors.textSecondary}>
        {label}
      </FocusText>
    </FocusableButton>
  );
}

const FIRST_KEY = 'k-0-0';
/** How long the first key keeps its preference after the screen opens. */
const ARRIVAL_MS = 1000;

export const KEY_SIZE = 72;
export const KEY_GAP = 14;
export const KEYBOARD_WIDTH = KEY_SIZE * 7 + KEY_GAP * 6;

const styles = createScaledStyles({
  grid: {width: KEYBOARD_WIDTH, gap: KEY_GAP},
  row: {flexDirection: 'row', gap: KEY_GAP},
  key: {
    width: KEY_SIZE,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    fontWeight: '600',
  },
  arabic: {fontFamily: undefined, fontSize: 30},
  wideWrap: {flex: 1},
  wide: {
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
  },
});
