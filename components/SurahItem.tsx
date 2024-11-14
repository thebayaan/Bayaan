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
import {MakkahIcon, MadinahIcon, PlayIcon} from '@/components/Icons';

interface SurahItemProps {
  item: Surah;
  onPress: (item: Surah) => void;
  showPlayButton?: boolean;
  onPlayPress?: (item: Surah) => void;
}

export const SurahItem: React.FC<SurahItemProps> = React.memo(
  ({item, onPress, showPlayButton = false, onPlayPress}) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);
    const revelationPlace = item.revelation_place.toLowerCase() as
      | 'makkah'
      | 'madinah';

    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const handlePlayPress = React.useCallback(
      (e: GestureResponderEvent) => {
        e.stopPropagation();
        onPlayPress && onPlayPress(item);
      },
      [item, onPlayPress],
    );

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
        </View>
        {showPlayButton && (
          <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
            <PlayIcon color={theme.colors.text} size={moderateScale(24)} />
          </TouchableOpacity>
        )}
        <View style={styles.iconOverlay}>
          <IconComponent
            size={moderateScale(80)}
            color={theme.colors.primary}
          />
        </View>
      </TouchableOpacity>
    );
  },
);

SurahItem.displayName = 'SurahItem';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      width: '100%',
    },
    surahItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(10),
      backgroundColor: theme.colors.background,
      position: 'relative',
      overflow: 'hidden',
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
    playButton: {
      padding: moderateScale(10),
    },
    iconOverlay: {
      position: 'absolute',
      right: moderateScale(-5),
      top: moderateScale(-5),
      opacity: 0.1,
      transform: [{rotate: '-15deg'}],
    },
  });
