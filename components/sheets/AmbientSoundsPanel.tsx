import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {NativeSlider} from '@/components/native/NativeSlider'; // @ai
import Svg, {Line, Circle, Path, Rect, Polygon} from 'react-native-svg';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {useAmbientStore} from '@/store/ambientStore';
import {ambientAudioService} from '@/services/audio/AmbientAudioService';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  AmbientSoundType,
  AMBIENT_SOUND_LIST,
  AMBIENT_SOUNDS,
} from '@/types/ambient';
// @ai-start
import {useTranslation} from 'react-i18next';
import {useResponsive} from '@/hooks/useResponsive';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
// @ai-end

/**
 * AmbientSoundsPanel
 *
 * Ambient nature sounds and their volume: a 2-column grid of sound cards
 * with "None" as the first option, plus a volume slider at the bottom. On
 * iPad the sounds sit in rows of three. Shown in `AmbientSoundsSheet` or in
 * the iPad player's popover.
 */
// @ai-start
/**
 * When the sounds close, check if the main Quran player is playing. If it's
 * NOT playing, the user was just sampling: stop ambient playback. If it IS
 * playing, ambient continues alongside the recitation.
 */
export function stopAmbientSampling(): void {
  const isMainPlaying = usePlayerStore.getState().playback.state === 'playing';
  const {isEnabled, setEnabled} = useAmbientStore.getState();
  if (!isMainPlaying && isEnabled) {
    ambientAudioService.stop();
    setEnabled(false);
  }
}

/** The sounds and volume, shown in the sheet or in an iPad popover. */
export function AmbientSoundsPanel() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation('sheets');
  const {isTablet} = useResponsive();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai

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

  const isNoneSelected = !isEnabled;

  const options: SoundOption[] = [
    {
      type: 'none',
      label: t('ambient.none'),
      selected: isNoneSelected,
      onPress: handleNoneSelect,
    },
    ...AMBIENT_SOUND_LIST.map(soundType => ({
      type: soundType,
      label: t(`ambient.sounds.${soundType}`, {
        defaultValue: AMBIENT_SOUNDS[soundType].label,
      }),
      selected: currentSound === soundType && isEnabled,
      onPress: () => handleSoundSelect(soundType),
    })),
  ];

  const renderTile = (option: SoundOption) => (
    <Pressable
      key={option.type}
      accessibilityRole="button"
      accessibilityState={{selected: option.selected}}
      style={[
        styles.soundCard,
        isTablet && styles.soundCardTablet,
        option.selected && styles.soundCardSelected,
      ]}
      onPress={option.onPress}>
      <AmbientIcon type={option.type} color={theme.colors.text} />
      <Text
        numberOfLines={isTablet ? 1 : undefined}
        style={[
          styles.soundLabel,
          isTablet && styles.soundLabelTablet,
          option.selected && styles.soundLabelSelected,
        ]}>
        {option.label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('ambient.title')}</Text>
      </View>
      <View
        style={[
          styles.container,
          {paddingBottom: sheetBottomPadding},
          isTablet && styles.containerTablet,
        ]}>
        {isTablet ? (
          // Rows of three equal tiles, so the grid fills a menu or a card.
          <View style={styles.tabletGrid}>
            {chunk(options, TABLET_COLUMNS).map(row => (
              <View key={row[0].type} style={styles.tabletRow}>
                {row.map(renderTile)}
                {Array.from({length: TABLET_COLUMNS - row.length}, (_, i) => (
                  <View key={i} style={styles.tabletSpacer} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>{options.map(renderTile)}</View>
        )}

        {/* Volume Slider — only show when a sound is active */}
        {isEnabled && (
          <View style={styles.volumeSection}>
            <View style={styles.volumeHeader}>
              <Text style={styles.volumeLabel}>{t('ambient.volume')}</Text>
              <Text style={styles.volumeValue}>
                {t('percent', {value: Math.round(volume * 100)})}
              </Text>
            </View>
            <NativeSlider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={volume}
              onValueChange={handleVolumeChange}
              accessibilityLabel={t('ambient.volume')}
            />
          </View>
        )}
      </View>
    </>
  );
}
// @ai-end

const ICON_SIZE = moderateScale(34);
// @ai-start
const TABLET_COLUMNS = 3;

interface SoundOption {
  type: AmbientSoundType | 'none';
  label: string;
  selected: boolean;
  onPress: () => void;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
// @ai-end

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

export const createStyles = (theme: Theme) =>
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
    // @ai-start
    containerTablet: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    tabletGrid: {
      gap: 8,
    },
    tabletRow: {
      flexDirection: 'row',
      gap: 8,
    },
    // Matches a tile's side padding and border: a flex item never shrinks
    // below those, so a bare spacer left the last row's tiles wider.
    tabletSpacer: {
      flex: 1,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    soundCardTablet: {
      width: 'auto',
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderRadius: 14,
    },
    soundLabelTablet: {
      fontSize: 13,
    },
    // @ai-end
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
