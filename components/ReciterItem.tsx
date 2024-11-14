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
    const [moshafName1, moshafName2] = item.moshaf_name.split(' - ');

    return (
      <TouchableOpacity
        style={[styles.reciterItem, isSelected && styles.selectedReciterItem]}
        onPress={handlePress}>
        <View
          style={[
            styles.imageContainer,
            isSelected && styles.selectedImageContainer,
          ]}>
          <ReciterImage
            imageUrl={item.image_url}
            reciterName={item.name}
            style={styles.reciterImage}
          />
        </View>
        <View style={styles.reciterInfo}>
          <Text style={styles.reciterName}>{item.name}</Text>
          <View style={styles.moshafInfo}>
            <Icon
              name="book"
              type="entypo"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
            <View style={styles.moshafNameContainer}>
              <Text style={styles.moshafName}>{moshafName1}</Text>
              {moshafName2 && (
                <Text style={styles.moshafName}>{moshafName2}</Text>
              )}
            </View>
          </View>
        </View>
        {isSelected && (
          <Icon
            name="check-circle"
            type="feather"
            size={moderateScale(24)}
            color={theme.colors.primary}
            style={{marginLeft: moderateScale(10)}}
          />
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
    moshafInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(5),
    },
    moshafNameContainer: {
      marginLeft: moderateScale(5),
    },
    moshafName: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    selectedReciterItem: {
      borderRadius: moderateScale(12),
    },
    selectedImageContainer: {
      borderColor: theme.colors.primary,
    },
    checkIcon: {
      marginLeft: moderateScale(10),
    },
  });
