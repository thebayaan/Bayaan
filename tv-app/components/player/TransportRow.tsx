// tv-app/components/player/TransportRow.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';

export function TransportRow(): React.ReactElement {
  const {
    status,
    shuffle,
    repeat,
    toggle,
    next,
    prev,
    seekBy,
    setShuffle,
    setRepeat,
  } = useTVPlayerStore();

  const isPlaying = status === 'playing';

  return (
    <View style={styles.row}>
      <FocusableButton
        onPress={() => setShuffle(!shuffle)}
        accessibilityLabel="Shuffle"
        style={[styles.btn, shuffle && styles.btnActive]}>
        <Text style={styles.icon}>🔀</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() => void prev()}
        accessibilityLabel="Previous"
        style={styles.btn}>
        <Text style={styles.icon}>⏮</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() => seekBy(-15)}
        accessibilityLabel="Back 15 seconds"
        style={styles.btn}>
        <Text style={styles.small}>−15</Text>
      </FocusableButton>
      <FocusableButton
        onPress={toggle}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={styles.hero}
        hasTVPreferredFocus>
        <Text style={styles.heroIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() => seekBy(15)}
        accessibilityLabel="Forward 15 seconds"
        style={styles.btn}>
        <Text style={styles.small}>+15</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() => void next()}
        accessibilityLabel="Next"
        style={styles.btn}>
        <Text style={styles.icon}>⏭</Text>
      </FocusableButton>
      <FocusableButton
        onPress={() =>
          setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')
        }
        accessibilityLabel="Repeat"
        style={[styles.btn, repeat !== 'off' && styles.btnActive]}>
        <Text style={styles.icon}>🔁</Text>
      </FocusableButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {backgroundColor: 'rgba(255,255,255,0.14)'},
  icon: {color: colors.text, fontSize: 16},
  small: {color: colors.text, fontSize: 14, fontWeight: '600'},
  hero: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {color: colors.background, fontSize: 22, fontWeight: '700'},
});
