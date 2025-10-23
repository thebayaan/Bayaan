import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {Surah} from '@/data/surahData';
import {QueueIcon, HeartIcon} from '@/components/Icons';
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from './BaseModal';
import {Icon} from '@rneui/themed';
import {useLoved} from '@/hooks/useLoved';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
import {CheckIcon, DownloadIcon} from '@/components/Icons';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import Color from 'color';

interface SurahOptionsModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  surah: Surah;
  reciterId?: string;
  rewayatId?: string;
  onClose: () => void;
  onAddToQueue?: (surah: Surah) => Promise<void>;
}

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

const renderHtmlDefaultProps: Partial<RenderHTMLProps> = {
  enableExperimentalMarginCollapsing: true,
  enableExperimentalGhostLinesPrevention: true,
  enableExperimentalBRCollapsing: true,
  allowedStyles: [],
  enableCSSInlineProcessing: true,
  systemFonts: [
    ...defaultSystemFonts,
    'Manrope-Regular',
    'Manrope-Medium',
    'Manrope-Bold',
  ],
  baseStyle: {
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'Manrope-Regular',
  },
};

export const SurahOptionsModal: React.FC<SurahOptionsModalProps> = ({
  bottomSheetRef,
  surah,
  reciterId,
  rewayatId,
  onClose,
  onAddToQueue,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const scale = useSharedValue(1);
  const {width} = useWindowDimensions();

  const [showSummary, setShowSummary] = useState(false);

  // Calculate loved state - use isLovedWithRewayat if rewayatId is provided, otherwise use isLoved
  const isLovedState = reciterId
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surah.id.toString(), rewayatId)
      : isLoved(reciterId, surah.id.toString())
    : false;

  // Get surah info
  const currentSurahInfo = surahInfo[surah.id];

  const tagsStyles = React.useMemo(
    () => ({
      div: {
        color: theme.colors.text,
        fontSize: moderateScale(16),
        fontFamily: 'Manrope-Regular',
        lineHeight: moderateScale(24),
      } as MixedStyleDeclaration,
      p: {
        marginBottom: moderateScale(16),
      } as MixedStyleDeclaration,
      a: {
        color: theme.colors.primary,
        textDecorationLine: 'underline',
      } as MixedStyleDeclaration,
      li: {
        marginBottom: moderateScale(8),
      } as MixedStyleDeclaration,
      ul: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      } as MixedStyleDeclaration,
      ol: {
        marginBottom: moderateScale(16),
        paddingLeft: moderateScale(16),
      } as MixedStyleDeclaration,
    }),
    [theme.colors.text, theme.colors.primary],
  );

  const handleAddToQueue = useCallback(() => {
    onClose();
    if (onAddToQueue) {
      onAddToQueue(surah).catch(error => {
        console.error('Error adding to queue:', error);
      });
    }
  }, [onAddToQueue, surah, onClose]);

  const handleViewInfo = useCallback(() => {
    setShowSummary(true);
  }, []);

  const handleToggleLove = useCallback(() => {
    if (!reciterId) return;
    scale.value = withSpring(1.2, {}, () => {
      scale.value = withSpring(1);
    });

    // Use the provided rewayatId if available, otherwise use an empty string
    toggleLoved(reciterId, surah.id.toString(), rewayatId || '');
  }, [reciterId, surah.id, toggleLoved, scale, rewayatId]);

  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
  } = useDownload();

  // Calculate download state - use isDownloadedWithRewayat if rewayatId is provided, otherwise use isDownloaded
  const isTrackDownloaded = reciterId
    ? rewayatId
      ? isDownloadedWithRewayat(reciterId, surah.id.toString(), rewayatId)
      : isDownloaded(reciterId, surah.id.toString())
    : false;

  const handleDownload = useCallback(async () => {
    if (!reciterId) return; // Use reciterId from props, not currentTrack

    if (isTrackDownloaded) {
      console.log('Track already downloaded');
      return;
    }

    if (isDownloading(reciterId, surah.id.toString())) {
      console.log('Track is already downloading');
      return;
    }

    try {
      setDownloading(`${reciterId}-${surah.id}`);

      const downloadResult = await downloadSurah(
        surah.id, // Use surah.id directly
        reciterId, // Use reciterId from props
        rewayatId, // Use rewayatId from props
      );

      addDownload({
        reciterId,
        surahId: surah.id.toString(),
        rewayatId: rewayatId || '',
        filePath: downloadResult.filePath,
        fileSize: downloadResult.fileSize,
        downloadDate: Date.now(),
        status: 'completed',
      });

      clearDownloading(`${reciterId}-${surah.id}`);
    } catch (error) {
      console.error('Download failed:', error);
      clearDownloading(`${reciterId}-${surah.id}`);
    }
  }, [
    reciterId,
    surah.id,
    rewayatId,
    isTrackDownloaded,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSummary(false);
    }
  }, []);

  return (
    <BaseModal
      bottomSheetRef={bottomSheetRef}
      snapPoints={showSummary ? ['90%'] : ['50%']}
      title={showSummary ? `About ${surah.name}` : undefined}
      onChange={handleSheetChange}>
      {showSummary ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.content}>
            <RenderHtml
              {...renderHtmlDefaultProps}
              contentWidth={width - moderateScale(72)}
              source={{html: `<div>${currentSurahInfo.text}</div>`}}
              tagsStyles={tagsStyles}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.surahName}>{surah.name}</Text>
            <Text style={styles.surahTranslation}>
              {surah.translated_name_english}
            </Text>
          </View>

          <View style={styles.optionsGrid}>
            <TouchableOpacity
              style={[styles.option, !reciterId && styles.optionDisabled]}
              onPress={handleToggleLove}
              activeOpacity={reciterId ? 0.7 : 1}>
              <Animated.View style={animatedStyle}>
                <HeartIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={isLovedState}
                />
              </Animated.View>
              <Text
                style={[
                  styles.optionText,
                  !reciterId && styles.optionTextDisabled,
                ]}>
                {isLovedState ? 'Remove from Loved' : 'Add to Loved'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, !reciterId && styles.optionDisabled]}
              onPress={handleDownload}
              activeOpacity={reciterId ? 0.7 : 1}>
              <Animated.View style={animatedStyle}>
                {isTrackDownloaded ? (
                  <CheckIcon
                    color={theme.colors.text}
                    size={moderateScale(20)}
                  />
                ) : (
                  <DownloadIcon
                    color={theme.colors.text}
                    size={moderateScale(20)}
                  />
                )}
              </Animated.View>
              <Text style={[styles.optionText]}>
                {isTrackDownloaded ? 'Downloaded' : 'Download'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, !onAddToQueue && styles.optionDisabled]}
              onPress={handleAddToQueue}
              activeOpacity={onAddToQueue ? 0.7 : 1}>
              <View style={styles.rotatedIcon}>
                <QueueIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={true}
                />
              </View>
              <Text
                style={[
                  styles.optionText,
                  !onAddToQueue && styles.optionTextDisabled,
                ]}>
                Add to Queue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={handleViewInfo}
              activeOpacity={0.7}>
              <Icon
                name="info"
                type="feather"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
              <Text style={styles.optionText}>Learn About Surah</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </BaseModal>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: moderateScale(20),
    },
    header: {
      alignItems: 'center',
      marginBottom: moderateScale(24),
      gap: moderateScale(4),
    },
    surahName: {
      fontSize: moderateScale(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahTranslation: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    optionsGrid: {
      gap: moderateScale(8),
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      paddingHorizontal: moderateScale(16),
      backgroundColor: Color(theme.colors.card).alpha(0.5).toString(),
      borderRadius: moderateScale(12),
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    optionTextDisabled: {
      color: theme.colors.textSecondary,
    },
    rotatedIcon: {
      transform: [{rotate: '180deg'}],
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(20),
    },
  });
