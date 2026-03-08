import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Slider from '@react-native-community/slider';
import Svg, {Line, Circle, Path, Rect, Polygon} from 'react-native-svg';
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
            <AmbientIcon type="none" color={theme.colors.text} />
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
                <AmbientIcon type={soundType} color={theme.colors.text} />
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

const ICON_SIZE = moderateScale(34);

interface AmbientIconProps {
  type: AmbientSoundType | 'none';
  color: string;
}

const AmbientIcon: React.FC<AmbientIconProps> = ({type, color}) => {
  const fill = Color(color).alpha(0.12).toString();
  const fillDeep = Color(color).alpha(0.25).toString();
  const s = ICON_SIZE;

  switch (type) {
    case 'none':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Circle
            cx="20"
            cy="20"
            r="14"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.4}
          />
          <Line
            x1="10"
            y1="10"
            x2="30"
            y2="30"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
        </Svg>
      );
    case 'rain':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Line
            x1="12"
            y1="6"
            x2="12"
            y2="24"
            stroke={fill}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Line
            x1="20"
            y1="4"
            x2="20"
            y2="28"
            stroke={fillDeep}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Line
            x1="28"
            y1="8"
            x2="28"
            y2="22"
            stroke={fill}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx="12" cy="30" r="3" fill={color} />
          <Circle cx="20" cy="34" r="3" fill={color} />
          <Circle cx="28" cy="28" r="3" fill={color} />
        </Svg>
      );
    case 'forest':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Rect x="4" y="12" width="5" height="24" rx="2.5" fill={fill} />
          <Rect x="12" y="6" width="5" height="30" rx="2.5" fill={fillDeep} />
          <Rect
            x="20"
            y="10"
            width="5"
            height="26"
            rx="2.5"
            fill={color}
            opacity={0.7}
          />
          <Rect x="28" y="14" width="5" height="22" rx="2.5" fill={fill} />
          <Rect
            x="35"
            y="18"
            width="3"
            height="18"
            rx="1.5"
            fill={fillDeep}
            opacity={0.5}
          />
        </Svg>
      );
    case 'ocean':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Path d="M6 30a14 14 0 0128 0" fill={fill} />
          <Path d="M10 32a10 10 0 0120 0" fill={fillDeep} />
          <Path d="M14 34a6 6 0 0112 0" fill={color} opacity={0.5} />
          <Circle cx="20" cy="12" r="5" stroke={color} strokeWidth={1.5} />
          <Path d="M17.5 12a2.5 2.5 0 015 0" fill={fill} />
        </Svg>
      );
    case 'stream':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Path
            d="M8 4c12 4 12 12 0 16s0 12 12 16"
            stroke={fillDeep}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Path
            d="M20 4c12 4 12 12 0 16s0 12 12 16"
            stroke={fill}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Path
            d="M14 4c12 4 12 12 0 16s0 12 12 16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.6}
          />
        </Svg>
      );
    case 'thunder':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Polygon
            points="20,2 24,16 32,16 18,26 22,38 8,22 16,22"
            fill={color}
            opacity={0.7}
          />
          <Line
            x1="30"
            y1="6"
            x2="34"
            y2="4"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
          <Line
            x1="32"
            y1="12"
            x2="37"
            y2="11"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.3}
          />
          <Line
            x1="6"
            y1="28"
            x2="2"
            y2="30"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.3}
          />
        </Svg>
      );
    case 'fireplace':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Polygon points="20,2 28,22 12,22" fill={fill} />
          <Polygon points="20,8 25,22 15,22" fill={fillDeep} />
          <Polygon points="20,14 23,22 17,22" fill={color} opacity={0.5} />
          <Rect
            x="10"
            y="26"
            width="20"
            height="4"
            rx="2"
            fill={color}
            opacity={0.15}
          />
          <Rect
            x="8"
            y="32"
            width="24"
            height="4"
            rx="2"
            fill={color}
            opacity={0.1}
          />
        </Svg>
      );
    case 'wind':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40" fill="none">
          <Line
            x1="4"
            y1="10"
            x2="20"
            y2="10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Line
            x1="10"
            y1="16"
            x2="32"
            y2="16"
            stroke={fillDeep}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Line
            x1="6"
            y1="22"
            x2="36"
            y2="22"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.7}
          />
          <Line
            x1="12"
            y1="28"
            x2="30"
            y2="28"
            stroke={fillDeep}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Line
            x1="8"
            y1="34"
            x2="18"
            y2="34"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
        </Svg>
      );
  }
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
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
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(6),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    soundCardSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      borderColor: Color(theme.colors.text).alpha(0.3).toString(),
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
