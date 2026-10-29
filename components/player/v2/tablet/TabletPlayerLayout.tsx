// @ai-generated
import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useReadingThemeColors} from '@/hooks/useReadingThemeColors';
import {useTimestampLoader} from '@/hooks/useTimestampLoader';
import {useAyahTracker} from '@/hooks/useAyahTracker';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {usePlayerDismissGesture} from '../PlayerDismissContext';
import {
  CloseButton,
  PaneSwitcher,
  ReadingTools,
  type PlayerPane,
} from './PlayerParts';
import {NowPlayingColumn} from './NowPlayingColumn';
import {TransportCard} from './TransportCard';
import {PlayerPaneBody} from './PlayerPaneBody';
import {
  PLAYER_EXPANDED_MIN_WIDTH,
  READING_COLUMN_MAX,
  nowPlayingArtSize,
  nowPlayingColumnWidth,
  playerPageMargin,
} from './playerMetrics';

export interface TabletPlayerHandlers {
  onSpeedPress: () => void;
  onSleepTimerPress: () => void;
  onMushafLayoutPress: () => void;
  onAmbientPress: () => void;
  onOptionsPress: () => void;
  onFollowAlongPress: () => void;
}

/**
 * The iPad full player (listening/02). The layout follows the window width,
 * never the orientation:
 * - medium (< 900): one reading column under a top bar, with the transport
 *   card floating at the bottom;
 * - expanded and large (≥ 900): the Now Playing column on the leading side
 *   and the switchable pane on the trailing side.
 * The pane switcher picks Text, Queue or Reciters; the card and the column
 * never move when it does.
 */
export function TabletPlayerLayout({
  onSpeedPress,
  onSleepTimerPress,
  onMushafLayoutPress,
  onAmbientPress,
  onOptionsPress,
  onFollowAlongPress,
}: TabletPlayerHandlers) {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const readingColors = useReadingThemeColors();
  const {setImmersive} = usePlayerActions();
  const barDismissGesture = usePlayerDismissGesture();
  const hasReciter = usePlayerStore(
    s => !!s.queue.tracks?.[s.queue.currentIndex ?? -1]?.reciterId,
  );

  useTimestampLoader();
  useAyahTracker();

  // The controls never cover the text here, so the immersive mode the phone
  // player toggles on a verse tap has nothing to hide.
  useEffect(() => {
    setImmersive(false);
  }, [setImmersive]);

  const [pane, setPane] = useState<PlayerPane>('text');
  const activePane: PlayerPane =
    pane === 'reciters' && !hasReciter ? 'text' : pane;

  const [cardHeight, setCardHeight] = useState(0);
  const handleCardLayout = useCallback((e: LayoutChangeEvent) => {
    setCardHeight(e.nativeEvent.layout.height);
  }, []);

  const expanded = width >= PLAYER_EXPANDED_MIN_WIDTH;
  const margin = playerPageMargin(width);
  const toolHandlers = {onSpeedPress, onSleepTimerPress, onAmbientPress};

  const switcher = (
    <PaneSwitcher
      value={activePane}
      onChange={setPane}
      showReciters={hasReciter}
    />
  );
  const readingTools =
    activePane === 'text' ? (
      <ReadingTools
        onFollowAlongPress={onFollowAlongPress}
        onMushafLayoutPress={onMushafLayoutPress}
      />
    ) : null;

  if (expanded) {
    const columnWidth = nowPlayingColumnWidth(width);
    const paneWidth = width - columnWidth;
    return (
      <View
        style={[
          styles.root,
          styles.row,
          {backgroundColor: readingColors.background},
        ]}>
        <NowPlayingColumn
          width={columnWidth}
          margin={margin}
          artSize={nowPlayingArtSize(columnWidth, margin, height)}
          onOptionsPress={onOptionsPress}
          {...toolHandlers}
        />
        <View style={styles.pane}>
          <GestureDetector gesture={barDismissGesture}>
            <View
              style={[
                styles.bar,
                {marginTop: insets.top, paddingHorizontal: margin},
              ]}>
              <View style={styles.barSide} />
              {switcher}
              <View style={[styles.barSide, styles.barEnd]}>
                {readingTools}
              </View>
            </View>
          </GestureDetector>
          <PlayerPaneBody
            pane={activePane}
            width={paneWidth}
            bottomInset={insets.bottom}
          />
        </View>
      </View>
    );
  }

  const cardWidth = Math.min(width - 2 * margin, READING_COLUMN_MAX);
  const cardBottom = insets.bottom + margin;
  return (
    <View style={[styles.root, {backgroundColor: readingColors.background}]}>
      <GestureDetector gesture={barDismissGesture}>
        <View
          style={[
            styles.bar,
            {marginTop: insets.top, paddingHorizontal: margin},
          ]}>
          <View style={styles.barSide}>
            <CloseButton />
          </View>
          {switcher}
          {/* The track's "..." is on the transport card, beside its title. */}
          <View style={[styles.barSide, styles.barEnd]}>{readingTools}</View>
        </View>
      </GestureDetector>
      <View style={styles.pane}>
        <PlayerPaneBody
          pane={activePane}
          width={width}
          bottomInset={cardBottom + cardHeight}
        />
      </View>
      <TransportCard
        width={cardWidth}
        style={[
          styles.floatingCard,
          {bottom: cardBottom, left: (width - cardWidth) / 2},
        ]}
        onLayout={handleCardLayout}
        onOptionsPress={onOptionsPress}
        {...toolHandlers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  pane: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barEnd: {
    justifyContent: 'flex-end',
  },
  floatingCard: {
    position: 'absolute',
  },
});
