import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';

interface AdditionalControlsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenOptions: () => void;
}

const AdditionalControls: React.FC<AdditionalControlsProps> = ({
  isFavorite,
  onToggleFavorite,
  onOpenOptions,
}) => {
  const {theme} = useTheme();

  return (
    <View style={styles(theme).container}>
      <TouchableOpacity
        onPress={onOpenOptions}
        style={styles(theme).optionsButton}>
        <Icon
          name="ellipsis-horizontal"
          type="ionicon"
          size={moderateScale(18)}
          color={theme.colors.text}
          style={styles(theme).optionsButtonIcon}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleFavorite}>
        <Icon
          name={isFavorite ? 'heart' : 'heart-outline'}
          type="ionicon"
          size={moderateScale(24)}
          color={isFavorite ? theme.colors.primary : theme.colors.text}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      marginVertical: moderateScale(16),
    },
    optionsButton: {
      borderWidth: moderateScale(1),
      borderColor: theme.colors.textSecondary,
      borderRadius: moderateScale(25),
      padding: moderateScale(8),
    },
    optionsButtonIcon: {
      padding: moderateScale(4),
    },
  });

export default AdditionalControls;
