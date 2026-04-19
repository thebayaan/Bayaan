import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {useNavStore} from '../../store/navStore';
import {colors} from '../../theme/colors';
import {PauseIcon, PlayIcon} from '../../../components/Icons';

export function NowPlayingChip(): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const push = useNavStore(s => s.push);

  const item = queue[currentIndex];
  if (!item) return null;

  const isPlaying = status === 'playing';

  return (
    <FocusableButton
      onPress={() => push({screen: 'nowPlaying'})}
      accessibilityLabel={`Now playing ${item.title}. Open player.`}
      style={styles.chip}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          {isPlaying ? (
            <PauseIcon color={colors.background} size={14} />
          ) : (
            <PlayIcon color={colors.background} size={14} />
          )}
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: 280,
  },
  inner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {flex: 1, minWidth: 0, paddingRight: 4},
  title: {color: colors.text, fontSize: 13, fontWeight: '700'},
  sub: {color: colors.text, fontSize: 11, opacity: 0.65, fontWeight: '500'},
});
