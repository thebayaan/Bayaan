// The adhkar session's player on the Adhkar screen. It has the look of the
// app's FloatingPlayer pill (a GlassView on iOS 26, FrostedView elsewhere,
// same border, shadow, spacing, type and button sizes) but sits in the
// screen's content instead of floating over the tab bar. Tapping the body
// opens the playing dhikr; the close button ends the session.
import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigationContainerRef} from 'expo-router';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {GlassView} from 'expo-glass-effect';
import {useTranslation} from 'react-i18next';
import {moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {useFloatingPillStyle} from '@/hooks/useFloatingPillStyle'; // @ai
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {AdhkarSessionArtwork} from '@/components/adhkar/AdhkarSessionArtwork';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

export function AdhkarSessionPlayer({
  session,
}: {
  session: AdhkarSession;
}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const navigation = useNavigationContainerRef();
  const glassColorScheme = useGlassColorScheme();
  const dispatch = useAdhkarSessionStore(s => s.dispatch);

  const active = session.status === 'playing' || session.status === 'loading';
  const position = t('adhkar.dhikrPosition', {
    current: session.index + 1,
    total: session.items.length,
  });

  const handleOpen = useCallback(() => {
    openPlayingDhikr(navigation);
  }, [navigation]);

  // FloatingPlayer's container, without the absolute positioning.
  const containerStyle = useFloatingPillStyle(); // @ai

  const textColor = Color(theme.colors.text).alpha(0.85).toString();
  const subtitleColor = Color(theme.colors.textSecondary)
    .alpha(0.45)
    .toString();

  const Container = USE_GLASS ? GlassView : FrostedView;

  return (
    <Container
      testID="adhkar-session-player"
      style={containerStyle}
      {...(USE_GLASS
        ? {glassEffectStyle: 'regular' as const, colorScheme: glassColorScheme}
        : {})}>
      {/* A plain View row, as FloatingPlayer, so each button is focusable on
          its own; the open action lives on the body only. */}
      <View style={styles.content}>
        <Pressable
          testID="adhkar-now-playing-open"
          onPress={handleOpen}
          // @ai: an opacity dip, not the Android ripple
          style={({pressed}) => [styles.body, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${session.listTitle}, ${position}`}
          accessibilityHint={t('adhkar.openPlaying')}>
          <AdhkarSessionArtwork
            listId={session.listId}
            iconSize={moderateScale(18, 0.2)}
            style={[
              styles.artwork,
              {
                backgroundColor: Color(theme.colors.text)
                  .alpha(0.06)
                  .toString(),
              },
            ]}
          />
          <View style={styles.trackInfo}>
            <Text style={[styles.title, {color: textColor}]} numberOfLines={1}>
              {session.listTitle}
            </Text>
            <Text
              style={[styles.subtitle, {color: subtitleColor}]}
              numberOfLines={1}>
              {position}
            </Text>
          </View>
        </Pressable>
        <Pressable
          testID="adhkar-now-playing-toggle"
          onPress={() => dispatch({type: 'toggle'})}
          style={styles.button}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={active ? t('adhkar.pause') : t('adhkar.play')}>
          {active ? (
            <PauseIcon
              color={theme.colors.text}
              size={moderateScale(20, 0.2)}
            />
          ) : (
            <PlayIcon color={theme.colors.text} size={moderateScale(20, 0.2)} />
          )}
        </Pressable>
        <Pressable
          testID="adhkar-now-playing-close"
          onPress={() => dispatch({type: 'stop'})}
          style={styles.button}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('adhkar.stopSession')}>
          <Feather
            name="x"
            size={moderateScale(20, 0.2)}
            color={Color(theme.colors.text).alpha(0.6).toString()}
          />
        </Pressable>
      </View>
    </Container>
  );
}

// FloatingPlayer's metrics.
const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(14, 0.2),
    paddingVertical: moderateScale(7, 0.2),
    gap: moderateScale(10, 0.2),
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10, 0.2),
  },
  artwork: {
    width: moderateScale(36, 0.2),
    height: moderateScale(36, 0.2),
    borderRadius: moderateScale(8, 0.2),
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
    fontSize: moderateScale(13, 0.2),
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    textAlign: 'left',
    fontSize: moderateScale(11, 0.2),
    fontFamily: 'Manrope-Medium',
  },
  button: {
    width: moderateScale(34, 0.2),
    height: moderateScale(34, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
