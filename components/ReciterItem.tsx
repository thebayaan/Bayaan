import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';

interface ReciterItemProps {
  item: Reciter;
  onPress: (item: Reciter) => void;
  isSelected?: boolean;
}

export const ReciterItem: React.FC<ReciterItemProps> = React.memo(
  ({item, onPress, isSelected}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={[styles.reciterItem, isSelected && styles.selectedReciterItem]}
        onPress={handlePress}>
        <View
          style={[
            styles.imageContainer,
            isSelected && styles.selectedImageContainer,
          ]}>
          <ReciterImage
            imageUrl={item.image_url || undefined}
            reciterName={item.name}
            style={styles.reciterImage}
          />
        </View>
        <View style={styles.reciterInfo}>
          <Text style={styles.reciterName}>{item.name}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Icon
              name="check"
              type="material"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

ReciterItem.displayName = 'ReciterItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    reciterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
    },
    imageContainer: {
      width: moderateScale(60),
      height: moderateScale(60),
      marginRight: moderateScale(15),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: moderateScale(20),
      borderWidth: moderateScale(1),
      borderColor: 'transparent',
    },
    reciterImage: {
      width: moderateScale(60),
      height: moderateScale(60),
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    selectedReciterItem: {
      borderRadius: moderateScale(12),
    },
    selectedImageContainer: {
      borderColor: theme.colors.primary,
    },
    checkmarkContainer: {
      marginLeft: moderateScale(10),
    },
  });
