// @ai-generated
// The Home tab on phones, ordered by what people do when they open the app
// (PostHog, 30 days): what fits this moment first, then picking up where
// they left off (53% resume), their own reciters, something new, adhkar,
// rewayat, the reciter collections and their playlists. iPad keeps
// RecitersView's shelves.
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from '@/utils/scale';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useSettings} from '@/hooks/useSettings';
import branding, {type HomeRow, type HomeRowId} from '@/config/branding';
import {BayaanNowCard, HERO_HEIGHT} from './BayaanNowCard';
import {JumpBackIn} from './JumpBackIn';
import {FindSomethingNew, YourReciters} from './DiscoverSections';
import {
  AdhkarShelf,
  CollectionsPanel,
  PlaylistsShelf,
  RewayahShelf,
} from './HomeShelves';

const ALL_ROWS: readonly HomeRow[] = [
  {id: 'continue-listening', enabled: true},
  {id: 'new-to-quran', enabled: true},
  {id: 'favorites', enabled: true},
  {id: 'featured', enabled: true},
  {id: 'adhkar', enabled: true},
  {id: 'follow-along', enabled: true},
  {id: 'playlists', enabled: true},
  {id: 'exclusives', enabled: true},
  {id: 'tajweed', enabled: true},
  {id: 'memorization', enabled: true},
  {id: 'rewayat', enabled: true},
  {id: 'collection', enabled: true},
];

export function HomeView() {
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  // The cover reaches up behind the clock, past the content's top padding.
  const skyInset = insets.top + moderateScale(8);
  // While the cover is under the clock, the clock is white.
  const [pastSky, setPastSky] = useState(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // With the glass layout the offset starts at -insets.top.
      const offset =
        e.nativeEvent.contentOffset.y + (USE_GLASS ? insets.top : 0);
      const past = offset > HERO_HEIGHT * 0.6;
      setPastSky(prev => (prev === past ? prev : past));
    },
    [insets.top],
  );
  const {incrementRecitersViewOpenCount} = useSettings();

  // The "New to Quran" prompt counts Home opens, as the old Home did.
  useEffect(() => {
    incrementRecitersViewOpenCount();
  }, [incrementRecitersViewOpenCount]);

  // A fork can turn rows off in branding.homeRowConfig; the new layout
  // keeps its own order but leaves out what a fork turned off.
  const enabled = useMemo(
    () =>
      new Set<HomeRowId>(
        (branding.homeRowConfig ?? ALL_ROWS)
          .filter(row => row.enabled)
          .map(row => row.id),
      ),
    [],
  );
  // RFC-008: a fork's own top region takes Bayaan Now's place.
  const ForkTop = branding.listenTabTopComponent;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        USE_GLASS
          ? styles.content
          : [
              styles.content,
              {
                paddingTop: insets.top + moderateScale(8),
                paddingBottom: bottomInset,
              },
            ]
      }
      contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
      onScroll={ForkTop ? undefined : onScroll}
      scrollEventThrottle={32}
      showsVerticalScrollIndicator={false}>
      {ForkTop ? (
        <ForkTop />
      ) : (
        <BayaanNowCard topInset={skyInset} lightClock={!pastSky} />
      )}
      {enabled.has('continue-listening') ? <JumpBackIn /> : null}
      {enabled.has('favorites') ? <YourReciters /> : null}
      <FindSomethingNew />
      {enabled.has('adhkar') ? <AdhkarShelf /> : null}
      {enabled.has('rewayat') ? <RewayahShelf /> : null}
      <CollectionsPanel enabled={enabled} />
      {enabled.has('playlists') ? <PlaylistsShelf /> : null}
      <View style={styles.end} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: moderateScale(8),
  },
  end: {
    height: moderateScale(36),
  },
});
