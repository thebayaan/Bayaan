import React, {useCallback, useMemo, useRef} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {expandPlayerSheet} from '@/services/player/sheetRef';
import {useMiniPlayerAnchor} from '@/components/player/v2/useMiniPlayerAnchor';
import {PlayIcon, PauseIcon} from '@/components/Icons';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {ReciterImage} from '@/components/ReciterImage';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
import {getTrackDisplayTitle, getTrackArtistDisplay} from '@/i18n/format';
import {appLayoutDirection} from '@/utils/rtl';
// @ai-end

const capsuleRadius = (height: number) => height / 2;
const artworkCornerRadius = () => 8;

// @ai-start
function MiniPlayerInner() {
  const {theme} = useTheme();
  const {t} = useTranslation(['player', 'common']);
  const {play, pause} = usePlayerActions();
  const playbackState = usePlayerStore(state => state.playback.state);
  const queueTracks = usePlayerStore(state => state.queue.tracks);
  const currentIndex = usePlayerStore(state => state.queue.currentIndex);
  const trackLoading = usePlayerStore(state => state.loading.trackLoading);
  const stateRestoring = usePlayerStore(state => state.loading.stateRestoring);
  const prevTrackIdRef = useRef<string | null>(null);

  const currentTrack = useMemo(
    () => queueTracks?.[currentIndex],
    [queueTracks, currentIndex],
  );

  const isLoadingNewTrack = useMemo(() => {
    const isTrackChanging = currentTrack?.id !== prevTrackIdRef.current;
    if (currentTrack?.id) {
      prevTrackIdRef.current = currentTrack.id;
    }
    return (trackLoading && isTrackChanging) || playbackState === 'buffering';
  }, [trackLoading, playbackState, currentTrack?.id]);

  const handlePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [playbackState, pause, play]);

  // The bottom accessory is a capsule; the player surface grows out of it.
  const {anchorRef, artworkRef, openGesture} = useMiniPlayerAnchor({
    radius: capsuleRadius,
    artworkRadius: artworkCornerRadius,
  });

  const handlePress = useCallback(() => {
    expandPlayerSheet();
  }, []);

  if (stateRestoring || !currentTrack) return null;

  const textColor = theme.colors.text;

  return (
    // a11y — plain View row (not a grouping Pressable) so the play/pause
    // control is INDIVIDUALLY focusable by VoiceOver; the expand action lives
    // on the inner body only.
    // The accessory is hosted by UIKit; its own gesture root makes sure the
    // swipe-up pan is recognized there.
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={openGesture}>
        <View ref={anchorRef} style={[styles.row, appLayoutDirection]}>
          <Pressable
            onPress={handlePress}
            style={styles.body}
            accessibilityRole="button"
            accessibilityLabel={`${getTrackDisplayTitle(currentTrack)}, ${getTrackArtistDisplay(currentTrack)}`}
            accessibilityHint={t('a11y.openPlayer')}>
            <View
              ref={artworkRef}
              collapsable={false}
              style={styles.artworkWrap}>
              <ReciterImage
                reciterName={currentTrack.reciterName}
                style={styles.artwork}
              />
            </View>

            <View style={styles.trackInfo}>
              <Text
                style={[styles.title, {color: textColor}]}
                numberOfLines={1}>
                {getTrackDisplayTitle(currentTrack)}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  {color: Color(textColor).alpha(0.5).toString()},
                ]}
                numberOfLines={1}>
                {getTrackArtistDisplay(currentTrack)}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handlePlayPause}
            style={styles.playButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t(
              playbackState === 'playing'
                ? 'common:actions.pause'
                : 'common:actions.play',
            )}>
            {isLoadingNewTrack ? (
              <LoadingIndicator color={textColor} />
            ) : playbackState === 'playing' ? (
              <PauseIcon color={textColor} size={22} />
            ) : (
              <PlayIcon color={textColor} size={22} />
            )}
          </Pressable>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
// @ai-end

export const MiniPlayer: React.FC = React.memo(MiniPlayerInner);

// @ai-start
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  body: {
    // a11y — expand-to-full-player hit target (artwork + track info). Same
    // `gap` as the row it was split out of, so the artwork|trackInfo rhythm is
    // unchanged: this refactor is a11y-only, with no visual delta.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Explicit (empty) style: GestureHandlerRootView defaults to flex: 1,
  // which would change how the accessory sizes the row.
  gestureRoot: {},
  artworkWrap: {
    flexShrink: 0,
  },
  artwork: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    textAlign: 'left',
    fontSize: 13,
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    textAlign: 'left',
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
  },
  playButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
// @ai-end
