import React from 'react';
import {View, Pressable} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {PlayIcon, ShuffleIcon} from '@/components/Icons';
import {ActionButtonsProps} from '@/components/reciter-profile/types';
import Color from 'color';
import {Ionicons} from '@expo/vector-icons';

const GOLD_COLOR = '#FFD700';

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onFavoritePress,
  onShufflePress,
  onPlayPress,
  isFavoriteReciter,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.actionButtons}>
      <Pressable style={styles.circleButton} onPress={onFavoritePress}>
        <Ionicons
          name={isFavoriteReciter ? 'star' : 'star-outline'}
          size={moderateScale(20)}
          color={isFavoriteReciter ? GOLD_COLOR : theme.colors.textSecondary}
        />
      </Pressable>
      <Pressable
        style={[styles.circleButton, styles.playButton]}
        onPress={onPlayPress}>
        <View style={styles.playIconContainer}>
          <PlayIcon color={theme.colors.background} size={moderateScale(18)} />
        </View>
      </Pressable>
      <Pressable style={styles.circleButton} onPress={onShufflePress}>
        <ShuffleIcon color={theme.colors.text} size={moderateScale(20)} />
      </Pressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: moderateScale(16),
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(20),
    },
    circleButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.textSecondary).alpha(0.08).toString(),
      padding: moderateScale(8),
    },
    playButton: {
      width: moderateScale(42),
      height: moderateScale(42),
      backgroundColor: theme.colors.text,
    },
    playIconContainer: {
      paddingLeft: moderateScale(4),
    },
  });
