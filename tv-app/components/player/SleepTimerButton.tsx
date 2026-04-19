import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useOverlayStore} from '../../store/overlayStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {TimerIcon} from '../../../components/Icons';
import {colors} from '../../theme/colors';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const mins = Math.max(1, Math.ceil(ms / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function SleepTimerButton(): React.ReactElement {
  const sleep = useTVPlayerStore(s => s.sleep);
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    sleep.kind === 'timer' ? sleep.endsAt - Date.now() : 0,
  );

  useEffect(() => {
    if (sleep.kind !== 'timer') {
      setRemainingMs(0);
      return;
    }
    const tick = (): void => setRemainingMs(sleep.endsAt - Date.now());
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [sleep]);

  const active = sleep.kind !== 'off';
  const label =
    sleep.kind === 'timer'
      ? formatRemaining(remainingMs)
      : sleep.kind === 'endOfSurah'
      ? 'END'
      : null;

  return (
    <FocusableButton
      onPress={() => useOverlayStore.getState().open('sleep')}
      style={[
        styles.btn,
        active && styles.btnActive,
        label ? styles.wide : null,
      ]}
      accessibilityLabel={label ? `Sleep timer: ${label}` : 'Sleep timer'}>
      <View style={styles.inner}>
        <TimerIcon color={colors.text} size={18} />
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </FocusableButton>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {backgroundColor: 'rgba(255,255,255,0.18)'},
  wide: {width: 'auto', paddingHorizontal: 14},
  inner: {flexDirection: 'row', alignItems: 'center', gap: 6},
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
