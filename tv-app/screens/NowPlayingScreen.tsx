// tv-app/screens/NowPlayingScreen.tsx
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ArtworkBackdrop} from '../components/player/ArtworkBackdrop';
import {NowPlayingTitle} from '../components/player/NowPlayingTitle';
import {Scrubber} from '../components/player/Scrubber';
import {TransportRow} from '../components/player/TransportRow';
import {SecondaryOverlay} from '../components/player/SecondaryOverlay';
import {TopTabBar} from '../components/nav/TopTabBar';
import {AutoHideChrome} from '../components/primitives/AutoHideChrome';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {useFocusTimer} from '../hooks/useFocusTimer';
import {useReciters} from '../hooks/useReciters';
import {colors} from '../theme/colors';

export function NowPlayingScreen(): React.ReactElement {
  const {queue, currentIndex, positionSeconds, durationSeconds} =
    useTVPlayerStore();
  const {visible, reveal} = useFocusTimer(3000);
  const {reciters} = useReciters();

  const item = queue[currentIndex];
  const reciter = item
    ? reciters.find(r => r.id === item.reciterId) ?? null
    : null;

  return (
    <View
      style={styles.container}
      onTouchStart={reveal}
      accessible
      onAccessibilityAction={reveal}>
      <ArtworkBackdrop imageUrl={reciter?.image_url ?? null} />
      {item && (
        <NowPlayingTitle
          index={currentIndex}
          total={queue.length}
          surahName={item.title}
          reciterName={item.subtitle}
          rewayahName=""
        />
      )}
      <Scrubber
        positionSeconds={positionSeconds}
        durationSeconds={durationSeconds}
      />
      <AutoHideChrome visible={visible}>
        <TopTabBar />
        <TransportRow />
      </AutoHideChrome>
      <SecondaryOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
});
