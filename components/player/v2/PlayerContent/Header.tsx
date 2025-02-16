import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Icon} from '@rneui/themed';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {surahGlyphMap} from '@/utils/surahGlyphMap';

export const Header = () => {
  const {theme} = useTheme();
  const {queue, setSheetMode} = useUnifiedPlayer();

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const surahGlyph =
    surahNumber && surahGlyphMap[surahNumber]
      ? surahGlyphMap[surahNumber] + surahGlyphMap[0]
      : '';

  const handleClose = () => {
    setSheetMode('hidden');
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity
        activeOpacity={0.99}
        style={styles.closeButton}
        onPress={handleClose}>
        <Icon
          name="chevron-thin-down"
          type="entypo"
          size={moderateScale(22)}
          color={theme.colors.text}
        />
      </TouchableOpacity>
      <Text style={[styles.arabicSurahName, {color: theme.colors.text}]}>
        {surahGlyph}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    left: moderateScale(25),
    zIndex: 1,
  },
  arabicSurahName: {
    fontFamily: 'SurahNames',
    fontSize: moderateScale(24),
  },
});
