import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {StarIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';

interface ReciterProfileActionButtonsProps {
  onFavoritePress: () => void;
  onShufflePress: () => void;
  onPlayPress: () => void;
  isFavoriteReciter: boolean;
}

export const ReciterProfileActionButtons: React.FC<
  ReciterProfileActionButtonsProps
> = ({onFavoritePress, onShufflePress, onPlayPress, isFavoriteReciter}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.actionButton}
        onPress={onFavoritePress}>
        <StarIcon
          color={
            isFavoriteReciter
              ? theme.colors.primary
              : theme.colors.textSecondary
          }
          size={isFavoriteReciter ? moderateScale(38) : moderateScale(28)}
          filled={isFavoriteReciter}
        />
      </TouchableOpacity>
      <View style={styles.rightAlignedButtons}>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.actionButton}
          onPress={onShufflePress}>
          <ShuffleIcon color={theme.colors.text} size={moderateScale(32)} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.99}
          style={styles.playButton}
          onPress={onPlayPress}>
          <PlayIcon color={'white'} size={moderateScale(18)} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: moderateScale(5),
      paddingHorizontal: moderateScale(20),
    },
    rightAlignedButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      width: moderateScale(56),
      height: moderateScale(56),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: moderateScale(28),
      marginHorizontal: moderateScale(5),
    },
    playButton: {
      backgroundColor: theme.colors.primary,
      width: moderateScale(45),
      height: moderateScale(45),
      borderRadius: moderateScale(28),
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: moderateScale(10),
      paddingLeft: moderateScale(5),
    },
  });
