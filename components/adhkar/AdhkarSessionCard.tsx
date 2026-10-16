// The adhkar session's card at the head of Home's Continue Listening. It has
// the Quran recent card's design (RecentReciterCard, same styles): the list
// illustration, the list title, "Dhikr 4 of 23", progress through the list,
// "19 left" and a play/pause button. Tapping the image or title opens the
// playing dhikr; the playback zone toggles; a long press offers "Stop adhkar".
import React, {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigationContainerRef} from 'expo-router';
import Color from 'color';
import {LinearGradient} from 'expo-linear-gradient';
import {GlassView} from 'expo-glass-effect';
import {Slider} from '@miblanchard/react-native-slider';
import {SheetManager} from 'react-native-actions-sheet';
import {useReducedMotion} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {NowPlayingIndicator} from '@/components/NowPlayingIndicator';
import {createStyles} from '@/components/cards/recentCardStyles';
import {AdhkarSessionArtwork} from '@/components/adhkar/AdhkarSessionArtwork';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';
import {forceLTR} from '@/utils/rtl';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

/** Progress through the list: the current row counts as reached. */
export function sessionProgress(session: AdhkarSession): number {
  if (session.items.length === 0) return 0;
  return (session.index + 1) / session.items.length;
}

/** Rows after the current one. */
export function sessionRemaining(session: AdhkarSession): number {
  return Math.max(0, session.items.length - session.index - 1);
}

export function AdhkarSessionCard({
  session,
}: {
  session: AdhkarSession;
}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const navigation = useNavigationContainerRef();
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const reduceMotion = useReducedMotion();
  const glassColorScheme = useGlassColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const active = session.status === 'playing' || session.status === 'loading';
  const position = t('adhkar.dhikrPosition', {
    current: session.index + 1,
    total: session.items.length,
  });
  const remaining = t('adhkar.remaining', {count: sessionRemaining(session)});
  const {listTitle} = session;

  const handleOpen = useCallback(() => {
    openPlayingDhikr(navigation);
  }, [navigation]);

  const handleToggle = useCallback(() => {
    dispatch({type: 'toggle'});
  }, [dispatch]);

  const handleLongPress = useCallback(() => {
    SheetManager.show('adhkar-session-options', {
      payload: {title: listTitle, subtitle: position},
    });
  }, [listTitle, position]);

  const CardWrapper = USE_GLASS ? GlassView : View;

  return (
    <CardWrapper
      testID="adhkar-session-card"
      style={[styles.container, USE_GLASS && styles.glassContainer]}
      {...(USE_GLASS
        ? {glassEffectStyle: 'regular', colorScheme: glassColorScheme}
        : {})}>
      {/* Background layers (fallback for non-glass), as RecentReciterCard */}
      {!USE_GLASS && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: Color(theme.colors.text)
                  .alpha(0.04)
                  .toString(),
              },
            ]}
          />
          <LinearGradient
            colors={[
              Color(theme.colors.text).alpha(0.02).toString(),
              'transparent',
              Color(theme.colors.text).alpha(0.03).toString(),
            ]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* Body: image and title open the playing dhikr. The inner gap equals
          the container's, so the layout matches RecentReciterCard. */}
      <Pressable
        testID="adhkar-now-playing-open"
        accessibilityRole="button"
        accessibilityLabel={`${listTitle}, ${position}`}
        accessibilityHint={t('adhkar.openPlaying')}
        onPress={handleOpen}
        onLongPress={handleLongPress}
        style={bodyStyle.body}>
        <View style={styles.imageContainer}>
          <AdhkarSessionArtwork
            listId={session.listId}
            iconSize={moderateScale(40)}
            style={styles.image}
          />
        </View>
        <Text style={styles.reciterName} numberOfLines={1}>
          {listTitle}
        </Text>
      </Pressable>

      {/* Bottom zone: playback controls, toggles play and pause */}
      <Pressable
        testID="adhkar-now-playing-toggle"
        accessibilityRole="button"
        accessibilityLabel={active ? t('adhkar.pause') : t('adhkar.play')}
        onPress={handleToggle}
        onLongPress={handleLongPress}
        style={({pressed}) => [
          styles.playbackZone,
          pressed && styles.playbackZonePressed,
        ]}>
        <View style={styles.playbackRow}>
          <Text
            style={[styles.surahName, bodyStyle.subtitle]}
            numberOfLines={1}>
            {position}
          </Text>
          {active && (
            <View style={styles.playButtonContainer}>
              {/* Reduce Motion: the bars stay still. */}
              <NowPlayingIndicator
                isPlaying={!reduceMotion}
                barCount={3}
                barWidth={moderateScale(2)}
                gap={moderateScale(1.5)}
              />
            </View>
          )}
        </View>
        <View style={[styles.progressRow, forceLTR]}>
          <View style={styles.playButtonContainer}>
            {active ? (
              <PauseIcon color={theme.colors.text} size={moderateScale(10)} />
            ) : (
              <PlayIcon
                color={theme.colors.text}
                size={moderateScale(10)}
                filled={true}
              />
            )}
          </View>
          <Slider
            value={sessionProgress(session)}
            disabled={true}
            minimumTrackTintColor={Color(theme.colors.text)
              .alpha(0.35)
              .toString()}
            maximumTrackTintColor={Color(theme.colors.text)
              .alpha(0.08)
              .toString()}
            trackStyle={{
              height: moderateScale(3),
              borderRadius: moderateScale(2),
            }}
            thumbStyle={{height: 0, width: 0}}
            containerStyle={styles.sliderContainer}
          />
          <Text style={styles.timeRemaining}>{remaining}</Text>
        </View>
      </Pressable>
    </CardWrapper>
  );
}

const bodyStyle = StyleSheet.create({
  body: {gap: moderateScale(4)},
  subtitle: {flex: 1},
});
