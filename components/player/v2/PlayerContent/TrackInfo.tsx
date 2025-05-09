import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterById} from '@/services/dataService';
import {Reciter, Rewayat} from '@/data/reciterData';

export const TrackInfo = () => {
  const {theme} = useTheme();
  const {queue, setSheetMode} = useUnifiedPlayer();
  const {navigateToReciterProfile} = useReciterNavigation();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const [, setReciter] = useState<Reciter | null>(null);
  const [rewayat, setRewayat] = useState<Rewayat | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadReciter = async () => {
      if (!currentTrack?.reciterId) return;
      try {
        const data = await getReciterById(currentTrack.reciterId);
        if (mounted && data) {
          setReciter(data);
          // Find the rewayat if rewayatId is provided
          if (currentTrack.rewayatId && data.rewayat) {
            const foundRewayat = data.rewayat.find(
              r => r.id === currentTrack.rewayatId,
            );
            if (foundRewayat) {
              setRewayat(foundRewayat);
            }
          }
        }
      } catch (error) {
        console.error('Error loading reciter:', error);
      }
    };
    loadReciter();
    return () => {
      mounted = false;
    };
  }, [currentTrack]);

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
      <TouchableOpacity
        style={styles.trackItem}
        activeOpacity={0.7}
        onPress={handleReciterPress}>
        <View style={styles.imageContainer}>
          <ReciterImage
            imageUrl={currentTrack?.artwork}
            reciterName={currentTrack?.artist || ''}
            style={styles.reciterImage}
            profileIconSize={moderateScale(20)}
          />
        </View>
        <View style={styles.trackInfo}>
          <View style={styles.textContainer}>
            <Text
              style={[styles.surahName, {color: theme.colors.text}]}
              numberOfLines={1}>
              {currentTrack?.title || ''}
            </Text>
            <Text
              style={[styles.reciterName, {color: theme.colors.text}]}
              numberOfLines={1}>
              {currentTrack?.artist || ''}
            </Text>
            {rewayat && (
              <Text
                style={[
                  styles.rewayatText,
                  {color: theme.colors.textSecondary},
                ]}>
                {rewayat.name}
                {rewayat.style ? ` • ${rewayat.style}` : ''}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: moderateScale(10),
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(4),
  },
  imageContainer: {
    marginRight: moderateScale(12),
  },
  reciterImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(10),
  },
  trackInfo: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  surahName: {
    fontSize: moderateScale(14),
    fontFamily: 'Manrope-Bold',
    marginBottom: moderateScale(1),
  },
  reciterName: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-SemiBold',
    opacity: 0.7,
    marginBottom: moderateScale(1),
  },
  rewayatText: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-Medium',
    textTransform: 'capitalize',
    opacity: 0.7,
  },
});
