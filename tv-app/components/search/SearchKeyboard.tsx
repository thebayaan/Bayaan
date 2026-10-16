import React from 'react';
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
};

/**
 * The on-screen grid keyboard: 7 x 4 keys plus space, delete, clear and the
 * mode key. Keys are keyed by position, so a key keeps focus while the mode
 * changes its label. The guide brings focus back to the last key used when
 * it returns from the results.
 */
export function SearchKeyboard({
  mode,
  onKey,
  onSpace,
  onDelete,
  onClear,
  onMode,
  preferFirstKey,
}: Props): React.ReactElement {
  const rows = keyRows(mode);
  const arabic = mode === 'arabic';
  return (
    <TVFocusGuideView autoFocus style={styles.grid}>
      {rows.map((row, r) => (
        <View key={`row-${r}`} style={styles.row}>
          {row.map((key, c) =>
            key ? (
              <FocusableButton
                key={`k-${r}-${c}`}
                onPress={() => onKey(key)}
                hasTVPreferredFocus={preferFirstKey && r === 0 && c === 0}
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
        <WideKey label="space" onPress={onSpace} />
        <WideKey label="delete" onPress={onDelete} />
        <WideKey label="clear" onPress={onClear} />
        <WideKey
          label={modeKeyLabel(mode)}
          onPress={onMode}
          accessibilityLabel="Switch keyboard"
        />
      </View>
    </TVFocusGuideView>
  );
}

function WideKey({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}): React.ReactElement {
  return (
    <FocusableButton
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      containerStyle={styles.wideWrap}
      style={styles.wide}>
      <FocusText style={styles.wideText} color={colors.textSecondary}>
        {label}
      </FocusText>
    </FocusableButton>
  );
}

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
