import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';

export const TrackInfo = () => {
  const {theme} = useTheme();
  const {queue, setSheetMode} = useUnifiedPlayer();
  const {navigateToReciterProfile} = useReciterNavigation();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];

  const handleReciterPress = useCallback(() => {
    if (currentTrack) {
      setSheetMode('hidden');
      setTimeout(() => {
        navigateToReciterProfile(currentTrack.reciterId);
      }, 100);
    }
  }, [currentTrack, setSheetMode, navigateToReciterProfile]);

  return (
    <View style={styles.container}>
      <Text
        style={[styles.surahName, {color: theme.colors.text}]}
        numberOfLines={1}>
        {currentTrack?.title || ''}
      </Text>
      <TouchableOpacity activeOpacity={0.7} onPress={handleReciterPress}>
        <Text
          style={[styles.reciterName, {color: theme.colors.text}]}
          numberOfLines={1}>
          {currentTrack?.artist || ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  surahName: {
    fontSize: moderateScale(18),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(4),
    textAlign: 'center',
  },
  reciterName: {
    fontSize: moderateScale(16),
    fontFamily: 'Manrope-Medium',
    opacity: 0.7,
    textAlign: 'center',
  },
});
