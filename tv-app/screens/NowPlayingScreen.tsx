import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ArtworkBackdrop} from '../components/player/ArtworkBackdrop';
import {ErrorBanner} from '../components/player/ErrorBanner';
import {NowPlayingTitle} from '../components/player/NowPlayingTitle';
import {Scrubber} from '../components/player/Scrubber';
import {TransportRow} from '../components/player/TransportRow';
import {SecondaryOverlay} from '../components/player/SecondaryOverlay';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {useReciters} from '../hooks/useReciters';
import {colors} from '../theme/colors';

export function NowPlayingScreen(): React.ReactElement {
  const {queue, currentIndex, positionSeconds, durationSeconds} =
    useTVPlayerStore();
  const {reciters} = useReciters();

  const item = queue[currentIndex];
  const reciter = item
    ? reciters.find(r => r.id === item.reciterId) ?? null
    : null;

  return (
    <View style={styles.container}>
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
      <TransportRow />
      <ErrorBanner />
      <SecondaryOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
});
