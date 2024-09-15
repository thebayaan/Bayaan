import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Icon} from '@rneui/themed';
import {Reciter} from '@/data/reciterData';

const PLACEHOLDER_IMAGE = require('@/assets/images/placeholder_avatar.png');

interface ReciterItemProps {
  item: Reciter;
  onPress: (item: Reciter) => void;
}

export const ReciterItem: React.FC<ReciterItemProps> = React.memo(
  ({item, onPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const [moshafName1, moshafName2] = item.moshaf_name.split(' - ');

    return (
      <TouchableOpacity style={styles.reciterItem} onPress={handlePress}>
        <Image
          source={{uri: item.image_url || PLACEHOLDER_IMAGE}}
          style={styles.reciterImage}
        />
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
    reciterImage: {
      width: moderateScale(60),
      height: moderateScale(60),
      borderRadius: moderateScale(25),
      marginRight: moderateScale(15),
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
  });
