// @ai-generated
import React from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerA11y} from '@/hooks/usePlayerA11y';
import {usePlayerScrollable} from '@/hooks/usePlayerScrollable';
import {usePlayerDismissGesture} from '../PlayerDismissContext';
import {usePlayerTransport} from './usePlayerTransport';
import {useNowPlayingMeta} from './useNowPlayingMeta';
import {
  CloseButton,
  LoveButton,
  MoreButton,
  NowPlayingArtwork,
  RewayahChip,
  Scrubber,
  TransportRow,
  useListeningTools,
  type ListeningToolHandlers,
} from './PlayerParts';

interface NowPlayingColumnProps extends ListeningToolHandlers {
  width: number;
  margin: number;
  artSize: number;
  onOptionsPress: () => void;
}

/**
 * The leading column of the two-pane iPad player (listening/02, Surface 3):
 * artwork, title, reciter, rewayah, scrubber, transport and the listening
 * tools, vertically centered.
 */
export function NowPlayingColumn({
  width,
  margin,
  artSize,
  onOptionsPress,
  ...toolHandlers
}: NowPlayingColumnProps) {
  const {theme} = useTheme();
  const a11y = usePlayerA11y();
  const insets = useSafeAreaInsets();
  const dismissGesture = usePlayerDismissGesture();
  const ColumnScrollView = usePlayerScrollable() ?? ScrollView;
  const transport = usePlayerTransport();
  const meta = useNowPlayingMeta();
  const tools = useListeningTools(transport, toolHandlers);
  const canOpenReciter = !!meta.currentTrack?.reciterId;

  return (
    <GestureDetector gesture={dismissGesture}>
      <View
        style={[
          styles.root,
          {
            width,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            borderEndColor: Color(theme.colors.text).alpha(0.08).toString(),
          },
        ]}>
        {/* The track's "..." sits beside its title, so the bar has only Close. */}
        <View style={[styles.bar, {paddingHorizontal: margin}]}>
          <CloseButton />
        </View>
        <ColumnScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingHorizontal: margin},
          ]}
          showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={meta.goToReciter}
            disabled={!canOpenReciter}
            style={styles.art}
            {...a11y.nowPlaying(meta.title, meta.artist)}>
            <NowPlayingArtwork size={artSize} />
          </Pressable>
          <View style={styles.metaRow}>
            <View style={styles.metaText}>
              <Text
                style={[styles.title, {color: theme.colors.text}]}
                numberOfLines={2}>
                {meta.title}
              </Text>
              <Pressable
                onPress={meta.goToReciter}
                disabled={!canOpenReciter}
                accessibilityRole="link">
                <Text
                  style={[styles.artist, {color: theme.colors.textSecondary}]}
                  numberOfLines={1}>
                  {meta.artist}
                </Text>
              </Pressable>
            </View>
            <View style={styles.metaActions}>
              <LoveButton loved={meta.isLoved} onPress={meta.toggleLoved} />
              <MoreButton onPress={onOptionsPress} />
            </View>
          </View>
          {meta.rewayahLabel ? (
            <View style={styles.chip}>
              <RewayahChip label={meta.rewayahLabel} />
            </View>
          ) : null}
          <View style={styles.scrubber}>
            <Scrubber transport={transport} />
          </View>
          <TransportRow transport={transport} spread />
          <View style={styles.tools}>
            {tools.leading}
            {tools.trailing}
          </View>
        </ColumnScrollView>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  art: {
    alignSelf: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Manrope-Bold',
  },
  artist: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Manrope-Medium',
  },
  chip: {
    marginTop: 8,
  },
  scrubber: {
    marginTop: 16,
    marginBottom: 4,
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});
