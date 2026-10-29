// @ai-generated
import {useMemo} from 'react';
import type {AccessibilityProps} from 'react-native';
import {useTranslation} from 'react-i18next';

type RepeatMode = 'none' | 'queue' | 'track';

const button = (
  label: string,
  extra: Omit<
    AccessibilityProps,
    'accessibilityRole' | 'accessibilityLabel'
  > = {},
): AccessibilityProps => ({
  accessibilityRole: 'button',
  accessibilityLabel: label,
  ...extra,
});

/**
 * Accessibility props for the player's icon-only controls, shared by the
 * phone player, the tablet player, its controls column and the docked mini
 * player, so VoiceOver and TalkBack announce every control the same way.
 * Spread the result on the Pressable: `<Pressable {...a11y.next} />`.
 */
export function usePlayerA11y() {
  const {t} = useTranslation(['player', 'common']);

  return useMemo(
    () => ({
      nowPlaying: (title: string, artist: string, hint?: string) =>
        button(t('player:a11y.nowPlaying', {title, artist}), {
          accessibilityHint: hint ?? t('player:a11y.openReciter'),
        }),
      playPause: (playing: boolean, disabled = false) =>
        button(t(playing ? 'common:actions.pause' : 'common:actions.play'), {
          accessibilityState: {disabled},
        }),
      previous: (disabled = false) =>
        button(t('player:a11y.previous'), {accessibilityState: {disabled}}),
      next: (disabled = false) =>
        button(t('player:a11y.next'), {accessibilityState: {disabled}}),
      skipBack: (seconds: number, disabled = false) =>
        button(t('player:a11y.skipBack', {seconds}), {
          accessibilityState: {disabled},
        }),
      skipForward: (seconds: number, disabled = false) =>
        button(t('player:a11y.skipForward', {seconds}), {
          accessibilityState: {disabled},
        }),
      love: (loved: boolean) =>
        button(t('player:a11y.love'), {accessibilityState: {selected: loved}}),
      displayOptions: button(t('player:a11y.displayOptions')),
      speed: (rate: number) =>
        button(t('player:a11y.speed'), {
          accessibilityValue: {text: `${rate}x`},
        }),
      repeat: (mode: RepeatMode) =>
        button(t('player:a11y.repeat'), {
          accessibilityValue: {
            text: t(
              mode === 'track'
                ? 'player:a11y.repeatOne'
                : mode === 'queue'
                  ? 'player:a11y.repeatAll'
                  : 'player:a11y.repeatOff',
            ),
          },
        }),
      sleepTimer: (active: boolean) =>
        button(t('player:a11y.sleepTimer'), {
          accessibilityState: {selected: active},
        }),
      ambient: (active: boolean) =>
        button(t('player:a11y.ambient'), {
          accessibilityState: {selected: active},
        }),
      followAlong: (active: boolean) =>
        button(t('player:a11y.followAlong'), {
          accessibilityState: {selected: active},
        }),
      queue: (shown: boolean) =>
        button(t('player:a11y.queue'), {accessibilityState: {selected: shown}}),
      moreOptions: button(t('player:a11y.moreOptions')),
      closePlayer: button(t('player:a11y.closePlayer')),
      openFullProfile: button(t('player:a11y.openFullProfile')),
      openPlayer: (title: string, artist: string) =>
        button(t('player:a11y.nowPlaying', {title, artist}), {
          accessibilityHint: t('player:a11y.openPlayer'),
        }),
    }),
    [t],
  );
}

export type PlayerA11y = ReturnType<typeof usePlayerA11y>;
