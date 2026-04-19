import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useReciters} from '../../hooks/useReciters';
import {useNavStore} from '../../store/navStore';
import {colors} from '../../theme/colors';
import {PauseIcon, PlayIcon} from '../../../components/Icons';

export function NowPlayingChip(): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const push = useNavStore(s => s.push);
  const {reciters} = useReciters();

  const item = queue[currentIndex];
  if (!item) return null;

  const reciter = reciters.find(r => r.id === item.reciterId);
  const isPlaying = status === 'playing';

  return (
    <FocusableButton
      onPress={() => push({screen: 'nowPlaying'})}
      accessibilityLabel={`${isPlaying ? 'Playing' : 'Paused'}: ${
        item.title
      }. Open player.`}
      style={styles.chip}
      focusScale={1.04}>
      <View style={styles.inner}>
        <View style={styles.artwork}>
          {reciter?.image_url ? (
            <Image
              source={{uri: reciter.image_url}}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <View style={styles.artworkBadge}>
            {isPlaying ? (
              <PauseIcon color={colors.background} size={10} />
            ) : (
              <PlayIcon color={colors.background} size={10} />
            )}
          </View>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
      </View>
    </FocusableButton>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: 280,
  },
  inner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  artwork: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  artworkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  textWrap: {flex: 1, minWidth: 0, paddingRight: 4},
  title: {color: colors.text, fontSize: 13, fontWeight: '700'},
  sub: {color: colors.text, fontSize: 11, opacity: 0.65, fontWeight: '500'},
});
