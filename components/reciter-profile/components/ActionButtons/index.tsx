import React from 'react';
import {View, Pressable, Text, type TextStyle} from 'react-native';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {useTranslation} from 'react-i18next';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {DownloadIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {CircularProgress} from '@/components/CircularProgress';
import {ActionButtonsProps} from '@/components/reciter-profile/types';
import Color from 'color';
import {Ionicons} from '@expo/vector-icons';

const GOLD_COLOR = '#FFD700';

interface StableLabelProps {
  labels: string[];
  active: string;
  textStyle: TextStyle;
}

/**
 * Renders every label variant stacked so the slot is always as wide as the
 * longest one. Only the active label is visible, so toggling state never
 * shifts the button's content.
 */
const StableLabel: React.FC<StableLabelProps> = ({
  labels,
  active,
  textStyle,
}) => (
  <View style={stableLabelStyles.container}>
    {labels.map(label => (
      <Text
        key={label}
        style={[textStyle, label !== active && stableLabelStyles.hidden]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        importantForAccessibility={label === active ? 'auto' : 'no'}>
        {label}
      </Text>
    ))}
  </View>
);

const stableLabelStyles = ScaledSheet.create({
  container: {
    flexShrink: 1,
    alignItems: 'center',
  },
  hidden: {
    height: 0,
    opacity: 0,
  },
});

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFavoritePress,
  onShufflePress,
  onPlayPress,
  isFavoriteReciter,
  onDownloadAllPress,
  isDownloadingAll = false,
  downloadAllProgress = 0,
  allDownloaded = false,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['player', 'common']);
  const styles = createStyles(theme);

  const getDownloadAllLabel = () => {
    if (isDownloadingAll) return 'Cancel downloading all surahs';
    if (allDownloaded) return 'All surahs downloaded';
    return 'Download all surahs';
  };

  const favoriteLabel = t('player:reciterProfile.favorite');
  const favoritedLabel = t('player:reciterProfile.favorited');
  const downloadLabel = t('common:actions.download');
  const downloadedLabel = t('player:reciterProfile.downloaded');
  const progressLabel = `${Math.round(downloadAllProgress * 100)}%`;

  const getDownloadText = () => {
    if (isDownloadingAll) return progressLabel;
    if (allDownloaded) return downloadedLabel;
    return downloadLabel;
  };

  const renderDownloadIcon = () => {
    if (isDownloadingAll) {
      return (
        <CircularProgress
          progress={downloadAllProgress}
          size={moderateScale(15)}
          strokeWidth={moderateScale(1.8)}
          color={theme.colors.text}
        />
      );
    }
    if (allDownloaded) {
      return (
        <Ionicons
          name="arrow-down-circle"
          size={moderateScale(16)}
          color={theme.colors.text}
        />
      );
    }
    return <DownloadIcon color={theme.colors.text} size={moderateScale(16)} />;
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({pressed}) => [styles.playButton, pressed && styles.pressed]}
        onPress={onPlayPress}
        accessibilityRole="button">
        <PlayIcon color={theme.colors.background} size={moderateScale(15)} />
        <Text style={styles.playText}>
          {t('player:reciterProfile.playAll')}
        </Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable
          style={({pressed}) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
          onPress={onShufflePress}
          accessibilityRole="button">
          <ShuffleIcon color={theme.colors.text} size={moderateScale(15)} />
          <Text style={styles.secondaryText} numberOfLines={1}>
            {t('common:actions.shuffle')}
          </Text>
        </Pressable>
        <Pressable
          style={({pressed}) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
          onPress={onFavoritePress}
          accessibilityRole="button"
          accessibilityLabel={t('player:reciterProfile.favorite')}
          accessibilityState={{selected: isFavoriteReciter}}>
          <Ionicons
            name={isFavoriteReciter ? 'star' : 'star-outline'}
            size={moderateScale(15)}
            color={isFavoriteReciter ? GOLD_COLOR : theme.colors.text}
          />
          <StableLabel
            labels={[favoriteLabel, favoritedLabel]}
            active={isFavoriteReciter ? favoritedLabel : favoriteLabel}
            textStyle={styles.secondaryText}
          />
        </Pressable>
        {/* @ai-start */}
        {onDownloadAllPress ? (
          <Pressable
            style={({pressed}) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
            onPress={onDownloadAllPress}
            accessibilityRole="button"
            accessibilityLabel={getDownloadAllLabel()}>
            {renderDownloadIcon()}
            <StableLabel
              labels={
                isDownloadingAll
                  ? [downloadLabel, downloadedLabel, progressLabel]
                  : [downloadLabel, downloadedLabel]
              }
              active={getDownloadText()}
              textStyle={styles.secondaryText}
            />
          </Pressable>
        ) : null}
        {/* @ai-end */}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      paddingTop: moderateScale(6),
      gap: moderateScale(8),
    },
    playButton: {
      height: moderateScale(50),
      borderRadius: moderateScale(12),
      backgroundColor: theme.colors.text,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(8),
    },
    playText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.background,
    },
    row: {
      flexDirection: 'row',
      gap: moderateScale(8),
    },
    secondaryButton: {
      flex: 1,
      height: moderateScale(44),
      borderRadius: moderateScale(12),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.16).toString(),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(5),
      paddingHorizontal: moderateScale(8),
    },
    secondaryText: {
      flexShrink: 1,
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    pressed: {
      opacity: 0.7,
    },
  });
