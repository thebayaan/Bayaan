import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {HeartIcon} from '@/components/Icons';

interface AdditionalControlsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const AdditionalControls: React.FC<AdditionalControlsProps> = ({
  isFavorite,
  onToggleFavorite,
}) => {
  const {theme} = useTheme();

  return (
    <View style={styles(theme).container}>
      <TouchableOpacity
        onPress={onToggleFavorite}
        style={styles(theme).heartButton}>
        <HeartIcon
          color={isFavorite ? theme.colors.primary : theme.colors.text}
          size={moderateScale(30)}
          filled={isFavorite}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = (_theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      marginVertical: moderateScale(16),
      width: '100%',
    },
    heartButton: {
      padding: moderateScale(4),
      alignSelf: 'center',
    },
  });

export default AdditionalControls;
