// tv-app/components/player/TransportRow.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';

export function TransportRow(): React.ReactElement {
  const {
    status,
    shuffle,
    repeat,
    speed,
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
      <View style={styles.secondaryRow}>
        <FocusableButton
          onPress={() => useOverlayStore.getState().open('speed')}
          style={styles.sBtn}
          accessibilityLabel="Speed">
          <Text style={styles.sText}>{speed}x</Text>
        </FocusableButton>
        <FocusableButton
          onPress={() => useOverlayStore.getState().open('sleep')}
          style={styles.sBtn}
          accessibilityLabel="Sleep timer">
          <Text style={styles.sText}>⏱</Text>
        </FocusableButton>
        <FocusableButton
          onPress={() => useOverlayStore.getState().open('ambient')}
          style={styles.sBtn}
          accessibilityLabel="Ambient sounds">
          <Text style={styles.sText}>🌊</Text>
        </FocusableButton>
      </View>
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
  secondaryRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -44,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  sBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sText: {color: colors.text, fontSize: 12},
});
