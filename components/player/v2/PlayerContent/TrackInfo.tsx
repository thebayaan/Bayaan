import React, {useCallback, useEffect, useState} from 'react';
import Svg, { Circle } from 'react-native-svg';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterById} from '@/services/dataService';
import {Reciter, Rewayat} from '@/data/reciterData';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import { CheckIcon, DownloadIcon } from '@/components/Icons';

export const TrackInfo = () => {
  const {theme} = useTheme();
  const {queue, setSheetMode} = useUnifiedPlayer();
  const {navigateToReciterProfile} = useReciterNavigation();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const [, setReciter] = useState<Reciter | null>(null);
  const [rewayat, setRewayat] = useState<Rewayat | null>(null);
  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const scale = useSharedValue(1);

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
  const {isDownloaded, isDownloading, setDownloading, addDownload, clearDownloading} = useDownload();
  
  const isTrackDownloaded = currentTrack ? isDownloaded(currentTrack.reciterId, currentTrack.surahId) : false;

  const handleDownload = useCallback(async () => {
    if (!currentTrack) return;
    if (isTrackDownloaded) {
      console.log('Track already downloaded');
      return;
    }
    
    // Check if currently downloading
    if (isDownloading(currentTrack.reciterId, currentTrack.surahId)) {
      console.log('Track is already downloading');
      return;
    }
    try {
      // 1. Set downloading state
      setDownloading(`${currentTrack.reciterId}-${currentTrack.surahId}`);
      
      // 2. Download the file 
      const downloadResult = await downloadSurah(
        parseInt(currentTrack.surahId, 10),  // ← surahId should be a number
        currentTrack.reciterId,              // ← reciterId should be the UUID
        currentTrack.rewayatId
      );
      
      // 3. Add to downloads store
      addDownload({
        reciterId: currentTrack.reciterId,
        surahId: currentTrack.surahId,
        rewayatId: currentTrack.rewayatId,
        filePath: downloadResult.filePath,
        fileSize: downloadResult.fileSize,
        downloadDate: Date.now(),
        status: 'completed'
      });
      
      // 4. Clear downloading state
      clearDownloading(`${currentTrack.reciterId}-${currentTrack.surahId}`);
      
    } catch (error) {
      console.error('Download failed:', error);
      clearDownloading(`${currentTrack.reciterId}-${currentTrack.surahId}`);
    }
  }, [currentTrack, setDownloading, addDownload, clearDownloading]);

  const handleToggleLoved = useCallback(() => {
    if (currentTrack) {
      // Animate the heart
      scale.value = withSpring(1.2, {}, () => {
        scale.value = withSpring(1);
      });

      toggleTrackLoved(currentTrack);
    }
  }, [currentTrack, scale, toggleTrackLoved]);

  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const circumference = 2 * Math.PI * 18; // radius = 18

  return (
    <View style={styles.container}>
      <View style={styles.trackContainer}>
        <TouchableOpacity
          style={styles.trackInfoTouchable}
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
          <View style={styles.trackInfoTextContainer}>
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
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity 
  style={styles.downloadButton}
  onPress={handleDownload}  // ← Add this!
  activeOpacity={0.7}>
  <Svg width={40} height={40}>
    {/* Background circle */}
    <Circle cx="20" cy="20" r="18" stroke="#ccc" strokeWidth="2" fill="none" />
    
    {/* Progress circle */}
    <Circle 
      cx="20" cy="20" r="18" 
      stroke="#4CAF50" 
      strokeWidth="2" 
      fill="none"
      strokeDasharray={`${circumference}`}
      strokeDashoffset={circumference - (20 * circumference / 100)}
    />
  </Svg>
  
  {/* Icon in center */}
  <View style={styles.iconContainer}>
    {isTrackDownloaded ? (
      <CheckIcon color={theme.colors.text} size={20} />
    ) : (
      <DownloadIcon color={theme.colors.text} size={20} />
    )}
  </View>
</TouchableOpacity>

        <TouchableOpacity
          style={styles.loveButton}
          onPress={handleToggleLoved}
          activeOpacity={0.7}>
          <Animated.View style={animatedStyle}>
            <HeartIcon
              size={moderateScale(32)}
              color={isLoved ? 'red' : theme.colors.text}
              filled={isLoved}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: moderateScale(10),
  },
  trackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: moderateScale(8),
  },
  trackInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    marginRight: moderateScale(12),
  },
  reciterImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(6),
  },
  trackInfoTextContainer: {
    flexShrink: 1,
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
  spacer: {
    flex: 1,
  },
  loveButton: {
    paddingLeft: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
