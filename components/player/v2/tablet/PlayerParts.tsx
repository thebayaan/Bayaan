// @ai-generated
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {Feather, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerA11y} from '@/hooks/usePlayerA11y';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useAmbientStore} from '@/store/ambientStore';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {ReciterImage} from '@/components/ReciterImage';
import {
  AmbientIcon,
  HeartIcon,
  MicrophoneIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  RepeatOneIcon,
  SeekBackwardIcon,
  SeekForwardIcon,
  TimerIcon,
} from '@/components/Icons';
import {localizeDigits} from '@/i18n/format';
import {forceLTR} from '@/utils/rtl';
import {SEEK_INTERVAL, type PlayerTransport} from './usePlayerTransport';

/**
 * Building blocks of the iPad player (listening/02, "Shared building
 * blocks"), in plain points: the iPad player is never scaled.
 */

export type PlayerPane = 'text' | 'queue' | 'reciters';

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

function useToolColors(selected: boolean) {
  const {theme} = useTheme();
  return {
    glyph: selected ? theme.colors.primary : theme.colors.text,
    fill: selected
      ? Color(theme.colors.primary).alpha(0.12).toString()
      : 'transparent',
  };
}

type CircleButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  size?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A round 44pt button on a faint fill: close, "…", love. */
export function CircleButton({
  size = 44,
  children,
  style,
  ...rest
}: CircleButtonProps) {
  const {theme} = useTheme();
  return (
    <Pressable
      {...rest}
      style={({pressed}) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
        },
        pressed && styles.pressed,
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/** Closes the full player (chevron down, leading in the top bar). */
export function CloseButton() {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  const {setSheetMode} = usePlayerActions();
  return (
    <CircleButton onPress={() => setSheetMode('hidden')} {...a11y.closePlayer}>
      <Ionicons name="chevron-down" size={22} color={theme.colors.text} />
    </CircleButton>
  );
}

export function MoreButton({onPress}: {onPress: () => void}) {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  return (
    <CircleButton onPress={onPress} {...a11y.moreOptions}>
      <Feather name="more-horizontal" size={20} color={theme.colors.text} />
    </CircleButton>
  );
}

export function LoveButton({
  loved,
  onPress,
}: {
  loved: boolean;
  onPress: () => void;
}) {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  return (
    <CircleButton onPress={onPress} {...a11y.love(loved)}>
      <HeartIcon
        size={20}
        color={loved ? theme.colors.error : theme.colors.text}
        filled={loved}
      />
    </CircleButton>
  );
}

/**
 * The current track's artwork. Radius is 6% of the edge, kept between 8 and
 * 20pt; uploads without artwork get a microphone.
 */
export function NowPlayingArtwork({size}: {size: number}) {
  const {theme} = useTheme();
  const queue = usePlayerStore(s => s.queue);
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const radius = Math.min(20, Math.max(8, size * 0.06));
  const frame = {width: size, height: size, borderRadius: radius};
  return (
    <View
      style={[
        frame,
        styles.artShadow,
        {shadowOpacity: theme.isDarkMode ? 0.4 : 0.18},
      ]}>
      {currentTrack?.isUserUpload && !currentTrack?.artwork ? (
        <View
          style={[
            frame,
            styles.artPlaceholder,
            {backgroundColor: theme.colors.card},
          ]}>
          <MicrophoneIcon
            size={size * 0.35}
            color={theme.colors.textSecondary}
          />
        </View>
      ) : (
        <ReciterImage
          imageUrl={currentTrack?.artwork}
          reciterName={currentTrack?.artist || ''}
          style={frame}
          profileIconSize={size * 0.3}
        />
      )}
    </View>
  );
}

/** Rewayah and style as a small chip: "Hafs · Murattal". */
export function RewayahChip({label}: {label: string}) {
  const {theme} = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {backgroundColor: Color(theme.colors.text).alpha(0.06).toString()},
      ]}>
      <Text
        style={[styles.chipText, {color: theme.colors.textSecondary}]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Progress slider with elapsed and remaining time under it. */
export function Scrubber({transport}: {transport: PlayerTransport}) {
  const {theme} = useTheme();
  const {position, duration, isSeeking} = transport.scrubber;
  const text = theme.colors.text;
  return (
    <View style={forceLTR}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        tapToSeek
        value={position}
        onSlidingStart={transport.scrubber.onSlidingStart}
        onValueChange={transport.scrubber.onValueChange}
        onSlidingComplete={transport.scrubber.onSlidingComplete}
        minimumTrackTintColor={text}
        maximumTrackTintColor={Color(text).alpha(0.2).toString()}
        thumbTintColor={isSeeking ? text : 'transparent'}
      />
      <View style={styles.timeRow}>
        <Text style={[styles.time, {color: text}]}>
          {localizeDigits(formatTime(position))}
        </Text>
        <Text style={[styles.time, {color: theme.colors.textSecondary}]}>
          -{localizeDigits(formatTime(Math.max(0, duration - position)))}
        </Text>
      </View>
    </View>
  );
}

function SeekGlyph({
  forward,
  color,
}: {
  forward: boolean;
  color: string;
}): React.ReactElement {
  const Icon = forward ? SeekForwardIcon : SeekBackwardIcon;
  return (
    <View style={styles.seekGlyph}>
      <Icon color={color} size={26} />
      <Text
        style={[
          styles.seekLabel,
          forward ? styles.seekLabelEnd : styles.seekLabelStart,
          {color},
        ]}>
        {localizeDigits(SEEK_INTERVAL)}
      </Text>
    </View>
  );
}

/**
 * −15 · previous · play · next · +15. `spread` spaces the buttons across
 * the row (the Now Playing column); otherwise they sit together with 8pt
 * gaps (the transport card). Always left to right, as on the phone.
 */
export function TransportRow({
  transport,
  spread = false,
}: {
  transport: PlayerTransport;
  spread?: boolean;
}) {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  const {trackLoading, isLastTrack, isPlaying} = transport;
  const text = theme.colors.text;
  const muted = theme.colors.textSecondary;
  return (
    <View
      style={[
        styles.transport,
        spread ? styles.transportSpread : styles.transportPacked,
        forceLTR,
      ]}>
      <Pressable
        onPress={transport.seekBack}
        disabled={trackLoading}
        {...a11y.skipBack(SEEK_INTERVAL, trackLoading)}
        style={({pressed}) => [
          styles.transportButton,
          trackLoading && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <SeekGlyph forward={false} color={trackLoading ? muted : text} />
      </Pressable>
      <Pressable
        onPress={transport.previous}
        disabled={trackLoading}
        {...a11y.previous(trackLoading)}
        style={({pressed}) => [
          styles.transportButton,
          trackLoading && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <PreviousIcon color={trackLoading ? muted : text} size={22} />
      </Pressable>
      <Pressable
        onPress={transport.togglePlay}
        disabled={trackLoading}
        {...a11y.playPause(isPlaying, trackLoading)}
        style={({pressed}) => [
          styles.playButton,
          {backgroundColor: Color(text).alpha(0.08).toString()},
          pressed && styles.playPressed,
        ]}>
        {isPlaying ? (
          <PauseIcon color={text} size={30} />
        ) : (
          <PlayIcon color={text} size={30} />
        )}
      </Pressable>
      <Pressable
        onPress={transport.next}
        disabled={trackLoading || isLastTrack}
        {...a11y.next(trackLoading || isLastTrack)}
        style={({pressed}) => [
          styles.transportButton,
          (trackLoading || isLastTrack) && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <NextIcon color={isLastTrack ? muted : text} size={22} />
      </Pressable>
      <Pressable
        onPress={transport.seekForward}
        disabled={trackLoading}
        {...a11y.skipForward(SEEK_INTERVAL, trackLoading)}
        style={({pressed}) => [
          styles.transportButton,
          trackLoading && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <SeekGlyph forward color={trackLoading ? muted : text} />
      </Pressable>
    </View>
  );
}

type ToolButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  selected?: boolean;
  dimmed?: boolean;
  children: (color: string) => React.ReactNode;
};

/** A 44pt tool. Selected tools get a 12% primary fill and a primary glyph. */
export function ToolButton({
  selected = false,
  dimmed = false,
  children,
  ...rest
}: ToolButtonProps) {
  const colors = useToolColors(selected);
  return (
    <Pressable
      {...rest}
      style={({pressed}) => [
        styles.tool,
        {backgroundColor: colors.fill},
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}>
      {children(colors.glyph)}
    </Pressable>
  );
}

export interface ListeningToolHandlers {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onAmbientPress: () => void;
}

/** The listening tools: speed and repeat, then sleep timer and ambient. */
export function useListeningTools(
  transport: PlayerTransport,
  {onSpeedPress, onSleepTimerPress, onAmbientPress}: ListeningToolHandlers,
) {
  const a11y = usePlayerA11y();
  const ambientEnabled = useAmbientStore(s => s.isEnabled);
  const {playbackRate, repeatMode, isTimerActive} = transport;

  const speed = (
    <ToolButton
      key="speed"
      selected={playbackRate !== 1}
      onPress={onSpeedPress}
      {...a11y.speed(playbackRate)}>
      {color => (
        <Text style={[styles.toolLabel, {color}]}>
          {localizeDigits(`${playbackRate}x`)}
        </Text>
      )}
    </ToolButton>
  );
  const repeat = (
    <ToolButton
      key="repeat"
      selected={repeatMode !== 'none'}
      onPress={transport.cycleRepeat}
      {...a11y.repeat(repeatMode)}>
      {color =>
        repeatMode === 'track' ? (
          <RepeatOneIcon size={20} color={color} />
        ) : (
          <RepeatIcon size={20} color={color} />
        )
      }
    </ToolButton>
  );
  const sleep = (
    <ToolButton
      key="sleep"
      selected={isTimerActive}
      onPress={onSleepTimerPress}
      {...a11y.sleepTimer(isTimerActive)}>
      {color => <TimerIcon size={20} color={color} filled={isTimerActive} />}
    </ToolButton>
  );
  const ambient = (
    <ToolButton
      key="ambient"
      selected={ambientEnabled}
      onPress={onAmbientPress}
      {...a11y.ambient(ambientEnabled)}>
      {color => <AmbientIcon size={20} color={color} filled={ambientEnabled} />}
    </ToolButton>
  );
  return {leading: [speed, repeat], trailing: [sleep, ambient]};
}

/** The reading tools for the Text pane: follow along (◎) and Aa. */
export function ReadingTools({
  onFollowAlongPress,
  onMushafLayoutPress,
}: {
  onFollowAlongPress: () => void;
  onMushafLayoutPress: () => void;
}) {
  const a11y = usePlayerA11y();
  const queue = usePlayerStore(s => s.queue);
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const available = useRewayatFollowAlong(currentTrack?.rewayatId);
  const enabled = useTimestampStore(s => s.followAlongEnabled);
  const isLocked = useTimestampStore(s => s.isLocked);
  const active = available && enabled && isLocked;
  return (
    <>
      {/* Stays pressable when unavailable: the handler opens the Follow
          Along explainer instead. */}
      <ToolButton
        selected={active}
        dimmed={!available}
        onPress={onFollowAlongPress}
        {...a11y.followAlong(active)}>
        {color => <Ionicons name="locate-outline" size={20} color={color} />}
      </ToolButton>
      <ToolButton onPress={onMushafLayoutPress} {...a11y.displayOptions}>
        {color => (
          <MaterialCommunityIcons name="format-size" size={22} color={color} />
        )}
      </ToolButton>
    </>
  );
}

/** Text · Queue · Reciters. Reciters is left out without a reciter. */
export function PaneSwitcher({
  value,
  onChange,
  showReciters,
}: {
  value: PlayerPane;
  onChange: (pane: PlayerPane) => void;
  showReciters: boolean;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('player');
  const panes: PlayerPane[] = showReciters
    ? ['text', 'queue', 'reciters']
    : ['text', 'queue'];
  return (
    <View
      style={[
        styles.switcher,
        {backgroundColor: Color(theme.colors.text).alpha(0.06).toString()},
      ]}
      accessibilityRole="tablist">
      {panes.map(pane => {
        const selected = pane === value;
        return (
          <Pressable
            key={pane}
            onPress={() => onChange(pane)}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            style={[
              styles.segment,
              selected && [
                styles.segmentSelected,
                {backgroundColor: theme.colors.background},
              ],
            ]}>
            <Text
              style={[
                styles.segmentText,
                {
                  color: selected
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                },
              ]}>
              {t(`panes.${pane}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
  dimmed: {
    opacity: 0.35,
  },
  artShadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 24,
    borderCurve: 'continuous',
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  slider: {
    width: '100%',
    height: 44,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  time: {
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
    fontVariant: ['tabular-nums'],
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transportSpread: {
    justifyContent: 'space-between',
  },
  transportPacked: {
    gap: 8,
  },
  transportButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: {
    transform: [{scale: 0.92}],
  },
  seekGlyph: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 10,
    lineHeight: 10,
    fontFamily: 'Manrope-Bold',
  },
  seekLabelStart: {
    left: 3,
  },
  seekLabelEnd: {
    right: 3,
  },
  tool: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontSize: 14,
    fontFamily: 'Manrope-Bold',
  },
  switcher: {
    flexDirection: 'row',
    height: 36,
    borderRadius: 18,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 16,
    borderRadius: 15,
    justifyContent: 'center',
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
  },
  segmentText: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
});
