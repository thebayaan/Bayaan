import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {GlassView} from 'expo-glass-effect';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {SymbolView} from 'expo-symbols';
import {Pressable} from 'react-native-gesture-handler';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterById} from '@/services/dataService';
import {Reciter, Rewayat} from '@/data/reciterData';
import {useLoved} from '@/hooks/useLoved';
import {HeartIcon, MicrophoneIcon} from '@/components/Icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export const TrackInfo = () => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const queue = usePlayerStore(s => s.queue);
  const {navigateToReciterProfile} = useReciterNavigation();
  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const [, setReciter] = useState<Reciter | null>(null);
  const [rewayat, setRewayat] = useState<Rewayat | null>(null);
  const {isTrackLoved, toggleTrackLoved} = useLoved();
  const loveScale = useSharedValue(1);
  const loveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: loveScale.value}],
  }));

  useEffect(() => {
    setRewayat(null);
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

  const isUploadWithoutReciter =
    currentTrack?.isUserUpload && !currentTrack?.reciterId;
  const isUploadWithoutArtwork =
    currentTrack?.isUserUpload && !currentTrack?.artwork;

  const handleReciterPress = useCallback(() => {
    if (currentTrack && !isUploadWithoutReciter) {
      navigateToReciterProfile(currentTrack.reciterId);
    }
  }, [currentTrack, isUploadWithoutReciter, navigateToReciterProfile]);

  const handleToggleLoved = useCallback(() => {
    if (currentTrack) {
      if (!USE_GLASS) {
        loveScale.value = withSpring(1.2, {}, () => {
          loveScale.value = withSpring(1);
        });
      }
      toggleTrackLoved(currentTrack);
    }
  }, [currentTrack, loveScale, toggleTrackLoved]);

  const isLoved = currentTrack ? isTrackLoved(currentTrack) : false;

  return (
    <View style={styles.container}>
      <View style={styles.trackContainer}>
        <Pressable
          style={styles.trackInfoTouchable}
          onPress={handleReciterPress}>
          <View style={styles.imageContainer}>
            {isUploadWithoutArtwork ? (
              <View
                style={[
                  styles.reciterImage,
                  styles.uploadArtwork,
                  {backgroundColor: theme.colors.card},
                ]}>
                <MicrophoneIcon
                  size={moderateScale(20)}
                  color={theme.colors.textSecondary}
                />
              </View>
            ) : (
              <ReciterImage
                imageUrl={currentTrack?.artwork}
                reciterName={currentTrack?.artist || ''}
                style={styles.reciterImage}
                profileIconSize={moderateScale(20)}
              />
            )}
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
            {(rewayat || currentTrack?.rewayahName) && (
              <Text
                style={[
                  styles.rewayatText,
                  {color: theme.colors.textSecondary},
                ]}>
                {rewayat
                  ? `${rewayat.name}${rewayat.style ? ` • ${rewayat.style}` : ''}`
                  : currentTrack?.rewayahName}
              </Text>
            )}
          </View>
        </Pressable>

        {USE_GLASS ? (
          <GlassView
            style={styles.loveButton}
            glassEffectStyle="regular"
            colorScheme={glassColorScheme}
            isInteractive>
            <Pressable
              style={({pressed}) => [
                styles.loveButtonInner,
                {opacity: pressed ? 0.7 : 1},
              ]}
              onPress={handleToggleLoved}>
              <SymbolView
                name={isLoved ? 'heart.fill' : 'heart'}
                size={moderateScale(22)}
                tintColor={isLoved ? 'red' : theme.colors.text}
                weight="medium"
              />
            </Pressable>
          </GlassView>
        ) : (
          <FrostedView style={styles.loveButton}>
            <Pressable
              style={({pressed}) => [
                styles.loveButtonInner,
                {opacity: pressed ? 0.7 : 1},
              ]}
              onPress={handleToggleLoved}>
              <Animated.View style={loveAnimatedStyle}>
                <HeartIcon
                  size={moderateScale(22)}
                  color={isLoved ? 'red' : theme.colors.text}
                  filled={isLoved}
                />
              </Animated.View>
            </Pressable>
          </FrostedView>
        )}
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
  },
  trackInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imageContainer: {
    marginRight: moderateScale(12),
  },
  reciterImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
  },
  uploadArtwork: {
    justifyContent: 'center',
    alignItems: 'center',
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
  loveButton: {
    marginLeft: moderateScale(8),
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    overflow: 'hidden',
  },
  loveButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
