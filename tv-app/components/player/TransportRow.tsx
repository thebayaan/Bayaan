import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {SleepTimerButton} from './SleepTimerButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useOverlayStore} from '../../store/overlayStore';
import {colors} from '../../theme/colors';
import {
  AmbientIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatAllIcon,
  RepeatOneIcon,
  SeekBackward15Icon,
  SeekForward15Icon,
  ShuffleIcon,
} from '../../../components/Icons';

export function TransportRow(): React.ReactElement {
  const status = useTVPlayerStore(s => s.status);
  const shuffle = useTVPlayerStore(s => s.shuffle);
  const repeat = useTVPlayerStore(s => s.repeat);
  const speed = useTVPlayerStore(s => s.speed);
  const toggle = useTVPlayerStore(s => s.toggle);
  const next = useTVPlayerStore(s => s.next);
  const prev = useTVPlayerStore(s => s.prev);
  const seekBy = useTVPlayerStore(s => s.seekBy);
  const setShuffle = useTVPlayerStore(s => s.setShuffle);
  const setRepeat = useTVPlayerStore(s => s.setRepeat);

  const isPlaying = status === 'playing';
  const activeTint = colors.text;
  const idleTint = colors.text;

  return (
    <>
      <View style={styles.secondaryRow}>
        <FocusableButton
          onPress={() => useOverlayStore.getState().open('speed')}
          style={styles.sBtn}
          accessibilityLabel="Speed">
          <Text style={styles.sText}>{speed}x</Text>
        </FocusableButton>
        <SleepTimerButton />
        <FocusableButton
          onPress={() => useOverlayStore.getState().open('ambient')}
          style={styles.sBtn}
          accessibilityLabel="Ambient sounds">
          <AmbientIcon color={idleTint} size={22} />
        </FocusableButton>
      </View>
      <View style={styles.row}>
        <FocusableButton
          onPress={() => setShuffle(!shuffle)}
          accessibilityLabel="Shuffle"
          style={[styles.btn, shuffle && styles.btnActive]}>
          <ShuffleIcon color={shuffle ? activeTint : idleTint} size={26} />
        </FocusableButton>
        <FocusableButton
          onPress={() => void prev()}
          accessibilityLabel="Previous"
          style={styles.btn}>
          <PreviousIcon color={idleTint} size={30} />
        </FocusableButton>
        <FocusableButton
          onPress={() => seekBy(-15)}
          accessibilityLabel="Back 15 seconds"
          style={styles.btn}>
          <SeekBackward15Icon color={idleTint} size={30} />
        </FocusableButton>
        <FocusableButton
          onPress={toggle}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={styles.hero}
          hasTVPreferredFocus>
          {isPlaying ? (
            <PauseIcon color={colors.background} size={32} />
          ) : (
            <PlayIcon color={colors.background} size={32} />
          )}
        </FocusableButton>
        <FocusableButton
          onPress={() => seekBy(15)}
          accessibilityLabel="Forward 15 seconds"
          style={styles.btn}>
          <SeekForward15Icon color={idleTint} size={30} />
        </FocusableButton>
        <FocusableButton
          onPress={() => void next()}
          accessibilityLabel="Next"
          style={styles.btn}>
          <NextIcon color={idleTint} size={30} />
        </FocusableButton>
        <FocusableButton
          onPress={() =>
            setRepeat(
              repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off',
            )
          }
          accessibilityLabel="Repeat"
          style={[styles.btn, repeat !== 'off' && styles.btnActive]}>
          {repeat === 'one' ? (
            <RepeatOneIcon color={activeTint} size={26} />
          ) : (
            <RepeatAllIcon
              color={repeat === 'all' ? activeTint : idleTint}
              size={26}
            />
          )}
        </FocusableButton>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  btn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {backgroundColor: 'rgba(255,255,255,0.14)'},
  hero: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.text,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 0},
  },
  secondaryRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 148,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  sBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
