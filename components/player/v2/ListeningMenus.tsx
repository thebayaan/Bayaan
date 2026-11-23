// @ai-generated
import React, {type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {NativeMenu} from '@/components/native/NativeMenu';
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import type {NativeMenuItem} from '@/components/native/menuTypes';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useSleepTimerRemaining} from '@/hooks/useSleepTimerRemaining';
import {localizeDigits} from '@/i18n/format';
import {
  PLAYBACK_SPEEDS,
  SLEEP_TIMER_OPTIONS,
  selectedTimerOption,
} from '@/constants/playback';

/**
 * The player's speed and sleep-timer buttons open native pick-one menus,
 * anchored to the button, with a checkmark on the current choice. On iPad
 * this is the popover §8 asks for; phones get the same menu, so the control
 * behaves alike on both (ipad-standards goal 6). Without native menus (web)
 * they render the trigger alone, and its own `onPress` opens the sheet.
 */
export function PlaybackSpeedMenu({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  if (!nativeMenusAvailable) return <>{children}</>;
  return (
    <SpeedMenu accessibilityLabel={accessibilityLabel}>{children}</SpeedMenu>
  );
}

function SpeedMenu({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const {t} = useTranslation('sheets');
  const rate = usePlayerStore(s => s.playback.rate);
  const {setRate} = usePlayerActions();
  const items: NativeMenuItem[] = PLAYBACK_SPEEDS.map(speed => ({
    id: String(speed),
    title: localizeDigits(t('playbackSpeed.speed', {speed})),
    checked: speed === rate,
  }));
  return (
    <NativeMenu
      title={t('playbackSpeed.title')}
      entries={items}
      onSelect={id => setRate(Number(id))}
      accessibilityLabel={accessibilityLabel}>
      {children}
    </NativeMenu>
  );
}

export function SleepTimerMenu({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  if (!nativeMenusAvailable) return <>{children}</>;
  return (
    <TimerMenu accessibilityLabel={accessibilityLabel}>{children}</TimerMenu>
  );
}

function TimerMenu({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const {t} = useTranslation('sheets');
  const remaining = useSleepTimerRemaining();
  const {updateSettings} = usePlayerActions();
  const selected = selectedTimerOption(remaining, 0);
  const active = remaining !== null && remaining > 0;

  const title = !active
    ? t('sleepTimer.title')
    : remaining < 1
      ? t('sleepTimer.secondsRemaining', {count: Math.round(remaining * 60)})
      : t('sleepTimer.minutesRemaining', {count: Math.round(remaining)});

  const options: NativeMenuItem[] = SLEEP_TIMER_OPTIONS.map(minutes => ({
    id: String(minutes),
    title: localizeDigits(t('sleepTimer.minutesOption', {count: minutes})),
    checked: minutes === selected,
  }));

  return (
    <NativeMenu
      title={localizeDigits(title)}
      entries={
        active
          ? [
              {id: 'options', items: options},
              {
                id: 'off',
                title: t('sleepTimer.turnOff'),
                destructive: true,
                systemImage: 'timer',
              },
            ]
          : options
      }
      onSelect={id =>
        updateSettings({sleepTimer: id === 'off' ? 0 : Number(id)})
      }
      accessibilityLabel={accessibilityLabel}>
      {children}
    </NativeMenu>
  );
}
