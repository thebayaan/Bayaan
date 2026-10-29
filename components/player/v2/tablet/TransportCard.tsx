// @ai-generated
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {GlassView} from 'expo-glass-effect';
import {FrostedView} from '@/components/FrostedView';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerA11y} from '@/hooks/usePlayerA11y';
import {usePlayerDismissGesture} from '../PlayerDismissContext';
import {usePlayerTransport} from './usePlayerTransport';
import {useNowPlayingMeta} from './useNowPlayingMeta';
import {
  LoveButton,
  MoreButton,
  NowPlayingArtwork,
  Scrubber,
  TransportRow,
  useListeningTools,
  type ListeningToolHandlers,
} from './PlayerParts';

/** Below this inner width the listening tools move under the transport. */
const WRAP_TOOLS_BELOW = 500;
const PADDING = 16;

interface TransportCardProps extends ListeningToolHandlers {
  /** The card's width; the layout places it over the bottom of the pane. */
  width: number;
  style?: StyleProp<ViewStyle>;
  onOptionsPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * The floating card of the stacked iPad player (listening/02, Surface 2):
 * track row, scrubber, and the transport flanked by the listening tools.
 */
export function TransportCard({
  width,
  style,
  onOptionsPress,
  onLayout,
  ...toolHandlers
}: TransportCardProps) {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  const glassColorScheme = useGlassColorScheme();
  const dismissGesture = usePlayerDismissGesture();
  const transport = usePlayerTransport();
  const meta = useNowPlayingMeta();
  const tools = useListeningTools(transport, toolHandlers);
  const wrapTools = width - 2 * PADDING < WRAP_TOOLS_BELOW;
  const subtitle = meta.rewayahLabel
    ? `${meta.artist} · ${meta.rewayahLabel}`
    : meta.artist;

  return (
    <GestureDetector gesture={dismissGesture}>
      <View
        onLayout={onLayout}
        style={[
          styles.card,
          {width, shadowOpacity: theme.isDarkMode ? 0.4 : 0.12},
          style,
        ]}>
        {USE_GLASS ? (
          <GlassView
            style={[StyleSheet.absoluteFill, styles.material]}
            glassEffectStyle="regular"
            colorScheme={glassColorScheme}
          />
        ) : (
          <FrostedView style={[StyleSheet.absoluteFill, styles.material]} />
        )}
        <View style={styles.trackRow}>
          <Pressable
            onPress={meta.goToReciter}
            disabled={!meta.currentTrack?.reciterId}
            style={styles.track}
            {...a11y.nowPlaying(meta.title, meta.artist)}>
            <NowPlayingArtwork size={64} />
            <View style={styles.trackText}>
              <Text
                style={[styles.title, {color: theme.colors.text}]}
                numberOfLines={1}>
                {meta.title}
              </Text>
              <Text
                style={[styles.subtitle, {color: theme.colors.textSecondary}]}
                numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </Pressable>
          <LoveButton loved={meta.isLoved} onPress={meta.toggleLoved} />
          <MoreButton onPress={onOptionsPress} />
        </View>
        <Scrubber transport={transport} />
        {wrapTools ? (
          <>
            <View style={styles.centerRow}>
              <TransportRow transport={transport} />
            </View>
            <View style={styles.wrappedTools}>
              {tools.leading}
              {tools.trailing}
            </View>
          </>
        ) : (
          <View style={styles.controls}>
            <View style={styles.toolGroup}>{tools.leading}</View>
            <TransportRow transport={transport} />
            <View style={styles.toolGroup}>{tools.trailing}</View>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: PADDING,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 24,
  },
  material: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  track: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Manrope-Bold',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Manrope-Medium',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  centerRow: {
    alignItems: 'center',
  },
  wrappedTools: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
