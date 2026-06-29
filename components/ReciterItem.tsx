import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {MaterialIcons, Feather} from '@expo/vector-icons';
import {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {FollowAlongBadge} from '@/components/badges/FollowAlongBadge';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';

interface ReciterItemProps {
  item: Reciter;
  onPress: (item: Reciter) => void;
  isSelected?: boolean;
  secondaryText?: string;
  onOptionsPress?: (item: Reciter) => void;
  onLongPress?: (item: Reciter) => void;
  showFollowAlong?: boolean;
}

export const ReciterItem: React.FC<ReciterItemProps> = React.memo(
  ({
    item,
    onPress,
    isSelected,
    secondaryText,
    onOptionsPress,
    onLongPress,
    showFollowAlong,
  }) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const handleLongPress = React.useCallback(
      () => onLongPress?.(item),
      [item, onLongPress],
    );

    return (
      <Pressable
        style={[styles.reciterItem, isSelected && styles.selectedReciterItem]}
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}>
        <View
          style={[
            styles.imageContainer,
            isSelected && styles.selectedImageContainer,
          ]}>
          <ReciterImage
            imageUrl={item.image_url || undefined}
            reciterName={item.name}
            style={styles.reciterImage}
            profileIconSize={moderateScale(20)}
          />
        </View>
        <View style={styles.reciterInfo}>
          <Text style={styles.reciterName}>{item.name}</Text>
          <View style={styles.secondaryRow}>
            <Text style={styles.reciterRewayat} numberOfLines={1}>
              {secondaryText ||
                (item.rewayat.length > 1
                  ? `${item.rewayat.length} rewayat available`
                  : getDisplayLabelFromName(item.rewayat[0]?.name))}
            </Text>
            {showFollowAlong && <FollowAlongBadge />}
          </View>
        </View>
        {!onOptionsPress && isSelected && (
          <View style={styles.checkmarkContainer}>
            <MaterialIcons
              name="check"
              size={moderateScale(24)}
              color={theme.colors.primary}
            />
          </View>
        )}
        {onOptionsPress && (
          <Pressable
            style={styles.optionsZone}
            onPress={() => onOptionsPress(item)}
            hitSlop={8}>
            <Feather
              name="more-horizontal"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          </Pressable>
        )}
      </Pressable>
    );
  },
);

ReciterItem.displayName = 'ReciterItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    reciterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(8),
      paddingHorizontal: moderateScale(18),
    },
    imageContainer: {
      width: moderateScale(50),
      height: moderateScale(50),
      marginRight: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: moderateScale(50),
      borderWidth: moderateScale(1),
      borderColor: 'transparent',
    },
    reciterImage: {
      width: moderateScale(50),
      height: moderateScale(50),
    },
    reciterInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    reciterName: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      marginBottom: moderateScale(1),
    },
    reciterRewayat: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    selectedReciterItem: {
      borderRadius: moderateScale(10),
    },
    selectedImageContainer: {
      borderColor: theme.colors.primary,
    },
    checkmarkContainer: {
      marginLeft: moderateScale(8),
    },
    optionsZone: {
      width: moderateScale(44),
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
  });
