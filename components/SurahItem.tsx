import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {HeartIcon} from '@/components/Icons';
import {Icon} from '@rneui/themed';
import Color from 'color';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  reciterId?: string;
  isLoved?: boolean;
  onOptionsPress?: (item: Surah) => void;
}

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({item, onPress, isLoved = false, onOptionsPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const handleOptionsPress = React.useCallback(
      (e: GestureResponderEvent) => {
        e.stopPropagation();
        if (onOptionsPress) {
          onOptionsPress(item);
        }
      },
      [item, onOptionsPress],
    );

    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    return (
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.surahItem}
        onPress={handlePress}>
        <View style={styles.surahGlyphContainer}>
          <Text
            style={styles.surahGlyph}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {surahGlyphMap[item.id]}
          </Text>
        </View>
        <View style={styles.surahInfoContainer}>
          <View style={styles.nameContainer}>
            <Text style={styles.surahName}>{`${item.id}. ${item.name}`}</Text>
            {isLoved && (
              <HeartIcon
                size={moderateScale(14)}
                color={theme.colors.text}
                filled={true}
              />
            )}
          </View>
          <Text style={styles.surahSecondaryInfo}>
            {item.translated_name_english}
          </Text>
          <View
            style={[
              styles.locationIndicator,
              {backgroundColor: Color(theme.colors.card).alpha(0.8).toString()},
            ]}>
            {revelationPlace === 'makkah' ? (
              <MakkahIcon
                size={moderateScale(12)}
                color={theme.colors.textSecondary}
              />
            ) : (
              <MadinahIcon
                size={moderateScale(12)}
                color={theme.colors.textSecondary}
              />
            )}
            <Text style={styles.locationText}>
              {revelationPlace.charAt(0).toUpperCase() +
                revelationPlace.slice(1)}
            </Text>
          </View>
        </View>
        {onOptionsPress && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={handleOptionsPress}
            activeOpacity={0.7}>
            <Icon
              name="more-horizontal"
              type="feather"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  },
);

SurahItem.displayName = 'SurahItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      paddingHorizontal: moderateScale(15),
      backgroundColor: theme.colors.background,
      position: 'relative',
    },
    surahGlyphContainer: {
      width: moderateScale(60),
      height: moderateScale(50),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: moderateScale(5),
    },
    surahInfoContainer: {
      flex: 1,
      marginLeft: moderateScale(5),
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
    },
    surahName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    surahSecondaryInfo: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(4),
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'center',
      width: '100%',
    },
    locationIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      paddingHorizontal: moderateScale(6),
      paddingVertical: moderateScale(2),
      borderRadius: moderateScale(4),
      borderWidth: 1,
      borderColor: Color(theme.colors.border).alpha(0.1).toString(),
      alignSelf: 'flex-start',
    },
    locationText: {
      fontSize: moderateScale(10),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    optionsButton: {
      padding: moderateScale(8),
      marginLeft: moderateScale(8),
    },
  });
