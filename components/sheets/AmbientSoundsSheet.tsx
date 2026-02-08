import React, {useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Slider from '@react-native-community/slider';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {useAmbientStore} from '@/store/ambientStore';
import {ambientAudioService} from '@/services/audio/AmbientAudioService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  AmbientSoundType,
  AMBIENT_SOUND_LIST,
  AMBIENT_SOUNDS,
} from '@/types/ambient';

/**
 * AmbientSoundsSheet
 *
 * A bottom sheet for selecting ambient nature sounds and adjusting volume.
 * Displays a 2-column grid of sound cards with "None" as the first option,
 * plus a volume slider at the bottom.
 */
export const AmbientSoundsSheet = (props: SheetProps<'ambient-sounds'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  const currentSound = useAmbientStore(s => s.currentSound);
  const isEnabled = useAmbientStore(s => s.isEnabled);
  const volume = useAmbientStore(s => s.volume);
  const setSound = useAmbientStore(s => s.setSound);
  const setEnabled = useAmbientStore(s => s.setEnabled);
  const setVolume = useAmbientStore(s => s.setVolume);

  const handleSoundSelect = useCallback(
    (sound: AmbientSoundType) => {
      setSound(sound);
    },
    [setSound],
  );

  const handleNoneSelect = useCallback(() => {
    setEnabled(false);
  }, [setEnabled]);

  const handleVolumeChange = useCallback(
    (value: number) => {
      setVolume(value);
    },
    [setVolume],
  );

  /**
   * When the sheet closes, check if the main Quran player is playing.
   * If it's NOT playing, the user was just sampling — stop ambient playback.
   * If it IS playing, ambient should continue alongside recitation.
   */
  const handleBeforeClose = useCallback(() => {
    const playbackState = usePlayerStore.getState().playback.state;
    const isMainPlaying = playbackState === 'playing';

    if (!isMainPlaying && isEnabled) {
      ambientAudioService.stop();
      setEnabled(false);
    }
  }, [isEnabled, setEnabled]);

  const isNoneSelected = !isEnabled;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onBeforeClose={handleBeforeClose}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Ambient Sounds</Text>
      </View>
      <View style={styles.container}>
        {/* Sound Grid */}
        <View style={styles.grid}>
          {/* None option */}
          <Pressable
            style={[
              styles.soundCard,
              isNoneSelected && styles.soundCardSelected,
            ]}
            onPress={handleNoneSelect}>
            <Text style={styles.soundEmoji}>🚫</Text>
            <Text
              style={[
                styles.soundLabel,
                isNoneSelected && styles.soundLabelSelected,
              ]}>
              None
            </Text>
          </Pressable>

          {/* Sound options */}
          {AMBIENT_SOUND_LIST.map(soundType => {
            const meta = AMBIENT_SOUNDS[soundType];
            const isSelected = currentSound === soundType && isEnabled;
            return (
              <Pressable
                key={soundType}
                style={[
                  styles.soundCard,
                  isSelected && styles.soundCardSelected,
                ]}
                onPress={() => handleSoundSelect(soundType)}>
                <Text style={styles.soundEmoji}>
                  {getEmojiForSound(soundType)}
                </Text>
                <Text
                  style={[
                    styles.soundLabel,
                    isSelected && styles.soundLabelSelected,
                  ]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Volume Slider — only show when a sound is active */}
        {isEnabled && (
          <View style={styles.volumeSection}>
            <View style={styles.volumeHeader}>
              <Text style={styles.volumeLabel}>Volume</Text>
              <Text style={styles.volumeValue}>
                {Math.round(volume * 100)}%
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={volume}
              onValueChange={handleVolumeChange}
              minimumTrackTintColor={theme.colors.text}
              maximumTrackTintColor={Color(theme.colors.text)
                .alpha(0.2)
                .toString()}
              thumbTintColor={theme.colors.text}
            />
          </View>
        )}
      </View>
    </ActionSheet>
  );
};

/**
 * Returns an emoji representation for each ambient sound type.
 */
function getEmojiForSound(sound: AmbientSoundType): string {
  const emojiMap: Record<AmbientSoundType, string> = {
    rain: '🌧️',
    forest: '🌲',
    ocean: '🌊',
    stream: '🏞️',
    thunder: '⛈️',
    fireplace: '🔥',
    wind: '🍃',
  };
  return emojiMap[sound];
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: moderateScale(12),
    },
    soundCard: {
      width: '47%' as unknown as number,
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(12),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(6),
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    soundCardSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      borderColor: Color(theme.colors.text).alpha(0.3).toString(),
    },
    soundEmoji: {
      fontSize: moderateScale(28),
    },
    soundLabel: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    soundLabelSelected: {
      fontFamily: 'Manrope-Bold',
    },
    volumeSection: {
      marginTop: moderateScale(24),
    },
    volumeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(8),
    },
    volumeLabel: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    volumeValue: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.6).toString(),
    },
    slider: {
      width: '100%',
      height: moderateScale(40),
    },
  });
