import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {Surah} from '@/data/surahData';
import {MakkahIcon, MadinahIcon} from '@/components/Icons';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
}

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({item, onPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';
    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);

    const IconComponent =
      revelationPlace === 'makkah' ? MakkahIcon : MadinahIcon;

    return (
      <TouchableOpacity style={styles.surahItem} onPress={handlePress}>
        <View style={styles.surahGlyphContainer}>
          <Text
            style={styles.surahGlyph}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {surahGlyphMap[item.id]}
          </Text>
        </View>
        <View style={styles.surahInfoContainer}>
          <Text style={styles.surahName}>{`${item.id}. ${item.name}`}</Text>
          <Text style={styles.surahSecondaryInfo}>
            {item.translated_name_english}
          </Text>
          <IconComponent
            size={
              revelationPlace === 'makkah'
                ? moderateScale(14)
                : moderateScale(18)
            }
            color={theme.colors.textSecondary}
          />
        </View>
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
    },
    surahInfoContainer: {
      flex: 1,
      marginLeft: moderateScale(15),
    },
    surahName: {
      fontSize: moderateScale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: moderateScale(5),
    },
    surahSecondaryInfo: {
      fontSize: moderateScale(14),
      color: theme.colors.textSecondary,
    },
    surahGlyphContainer: {
      width: moderateScale(60),
      height: moderateScale(60),
      alignItems: 'center',
      justifyContent: 'center',
    },
    surahGlyph: {
      fontSize: moderateScale(24),
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'center',
    },
  });
