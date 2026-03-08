import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useRouter} from 'expo-router';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {getReciterById, getSurahById} from '@/services/dataService';
import {generateSmartAudioUrl} from '@/utils/audioUtils';
import {getReciterArtwork} from '@/utils/artworkUtils';
import {
  PlayIcon,
  QueueIcon,
  ProfileIcon,
  HeartIcon,
  StarIcon,
} from '@/components/Icons';

export const HomeCardOptionsSheet = (
  props: SheetProps<'home-card-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const {isFavoriteReciter, toggleFavorite} = useFavoriteReciters();
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {addToQueue} = usePlayerActions();

  const payload = props.payload;
  if (!payload) return null;

  const {
    reciterId,
    reciterName,
    surahId,
    surahName,
    rewayatId,
    recentIndex,
    variant,
  } = payload;

  const isFavorite = isFavoriteReciter(reciterId);
  const isLoved =
    surahId !== undefined && rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
      : false;

  const handleClose = useCallback(() => {
    SheetManager.hide('home-card-options');
  }, []);

  const handleGoToReciter = useCallback(() => {
    handleClose();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciterId},
      });
    }, 300);
  }, [handleClose, router, reciterId]);

  const handleToggleFavorite = useCallback(async () => {
    const reciter = await getReciterById(reciterId);
    if (reciter) toggleFavorite(reciter);
    handleClose();
  }, [reciterId, toggleFavorite, handleClose]);

  const handleToggleLoved = useCallback(() => {
    if (surahId !== undefined && rewayatId) {
      toggleLoved(reciterId, surahId, rewayatId);
    }
    handleClose();
  }, [reciterId, surahId, rewayatId, toggleLoved, handleClose]);

  const handleAddToQueue = useCallback(async () => {
    if (surahId === undefined) return;
    const reciter = await getReciterById(reciterId);
    const surah = getSurahById(surahId);
    if (!reciter || !surah) return;

    const rewayatToUseId = rewayatId || reciter.rewayat[0]?.id;
    if (!rewayatToUseId) return;

    const artwork = getReciterArtwork(reciter);
    const track = {
      id: `${reciter.id}:${surah.id}`,
      url: generateSmartAudioUrl(reciter, surah.id.toString(), rewayatToUseId),
      title: surah.name,
      artist: reciter.name,
      reciterId: reciter.id,
      artwork,
      surahId: surah.id.toString(),
      reciterName: reciter.name,
      rewayatId: rewayatToUseId,
    };

    addToQueue([track]);
    handleClose();
  }, [reciterId, surahId, rewayatId, addToQueue, handleClose]);

  const handleAddToPlaylist = useCallback(() => {
    if (surahId === undefined) return;
    const surah = getSurahById(surahId);
    if (!surah) return;
    handleClose();
    setTimeout(() => {
      SheetManager.show('select-playlist', {
        payload: {surah, reciterId, rewayatId},
      });
    }, 300);
  }, [reciterId, surahId, rewayatId, handleClose]);

  const handleRemoveFromRecents = useCallback(() => {
    if (recentIndex !== undefined) {
      useRecentlyPlayedStore.getState().removeTrack(recentIndex);
    }
    handleClose();
  }, [recentIndex, handleClose]);

  const handleContinuePlaying = useCallback(() => {
    handleClose();
    payload.onContinuePlaying?.();
  }, [handleClose, payload]);

  const iconSize = moderateScale(18);
  const iconColor = theme.colors.text;

  const title = variant === 'recent' ? (surahName ?? reciterName) : reciterName;
  const subtitle = variant === 'recent' ? reciterName : undefined;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.card}>
          {variant === 'recent' && (
            <>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleContinuePlaying}>
                <PlayIcon color={iconColor} size={iconSize} />
                <Text style={styles.optionText}>Continue playing</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleAddToQueue}>
                <View style={styles.rotatedIcon}>
                  <QueueIcon color={iconColor} size={iconSize} filled={true} />
                </View>
                <Text style={styles.optionText}>Add to queue</Text>
              </Pressable>

              <View style={styles.divider} />
            </>
          )}

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleGoToReciter}>
            <ProfileIcon color={iconColor} size={iconSize} filled={false} />
            <Text style={styles.optionText}>Go to reciter</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleToggleFavorite}>
            <StarIcon color={iconColor} size={iconSize} filled={isFavorite} />
            <Text style={styles.optionText}>
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </Text>
          </Pressable>

          {variant === 'recent' && (
            <>
              <View style={styles.divider} />

              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleToggleLoved}>
                <HeartIcon color={iconColor} size={iconSize} filled={isLoved} />
                <Text style={styles.optionText}>
                  {isLoved ? 'Remove from loved' : 'Add to loved'}
                </Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleAddToPlaylist}>
                <Feather name="plus-circle" size={iconSize} color={iconColor} />
                <Text style={styles.optionText}>Add to collection</Text>
              </Pressable>
            </>
          )}
        </View>

        {variant === 'recent' && (
          <View style={styles.destructiveCard}>
            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
              ]}
              onPress={handleRemoveFromRecents}>
              <Feather name="minus-circle" size={iconSize} color="#ff4444" />
              <Text style={styles.optionTextDestructive}>
                Remove from recents
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    header: {
      alignItems: 'center',
      marginTop: moderateScale(4),
      marginBottom: moderateScale(14),
      gap: moderateScale(2),
    },
    title: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
    },
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    divider: {
      height: 1,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      marginHorizontal: moderateScale(14),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(10),
    },
    rotatedIcon: {
      transform: [{rotate: '90deg'}],
    },
    destructiveCard: {
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
    },
    optionDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(11),
      paddingHorizontal: moderateScale(14),
    },
    optionDestructivePressed: {
      backgroundColor: 'rgba(255, 68, 68, 0.18)',
    },
    optionTextDestructive: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: '#ff4444',
      marginLeft: moderateScale(10),
    },
  });
