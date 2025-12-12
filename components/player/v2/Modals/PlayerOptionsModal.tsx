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
import BottomSheet from '@gorhom/bottom-sheet';
import {BaseModal} from '@/components/modals/BaseModal';
import {Icon} from '@rneui/themed';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
import {CheckIcon, ProfileIcon, HeartIcon} from '@/components/Icons';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import {SelectPlaylistModal} from '@/components/modals/SelectPlaylistModal';
import {useLoved} from '@/hooks/useLoved';
import Color from 'color';
import {CircularProgress} from '@/components/CircularProgress';
import {Ionicons} from '@expo/vector-icons';

interface PlayerOptionsModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>;
  surah: Surah;
  reciterId: string;
  rewayatId?: string;
  onClose: () => void;
  onGoToReciter: () => void;
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

export const PlayerOptionsModal: React.FC<PlayerOptionsModalProps> = ({
  bottomSheetRef,
  surah,
  reciterId,
  rewayatId,
  onClose,
  onGoToReciter,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {width} = useWindowDimensions();
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();

  const [showSummary, setShowSummary] = useState(false);
  const [pressedOption, setPressedOption] = useState<string | null>(null);
  const playlistModalRef = React.useRef<BottomSheet>(null);

  // Get surah info
  const currentSurahInfo = surahInfo[surah.id];

  // Calculate loved state - use isLovedWithRewayat if rewayatId is provided, otherwise use isLoved
  const isLovedState = rewayatId
    ? isLovedWithRewayat(reciterId, surah.id.toString(), rewayatId)
    : isLoved(reciterId, surah.id.toString());

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

  const handleViewInfo = useCallback(() => {
    setShowSummary(true);
  }, []);

  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    getDownloadProgress,
  } = useDownload();

  const downloadProgress = getDownloadProgress(reciterId, surah.id.toString());

  // Calculate download state - use isDownloadedWithRewayat if rewayatId is provided, otherwise use isDownloaded
  const isTrackDownloaded = rewayatId
    ? isDownloadedWithRewayat(reciterId, surah.id.toString(), rewayatId)
    : isDownloaded(reciterId, surah.id.toString());

  const handleDownload = useCallback(async () => {
    if (isTrackDownloaded) {
      console.log('Track already downloaded');
      return;
    }

    // Check if downloading - use rewayat-aware check if rewayatId is provided
    const isCurrentlyDownloading = rewayatId
      ? isDownloadingWithRewayat(reciterId, surah.id.toString(), rewayatId)
      : isDownloading(reciterId, surah.id.toString());

    if (isCurrentlyDownloading) {
      console.log('Track is already downloading');
      return;
    }

    try {
      // Generate download ID with rewayatId if provided for proper tracking
      const downloadId = rewayatId
        ? `${reciterId}-${surah.id}-${rewayatId}`
        : `${reciterId}-${surah.id}`;
      setDownloading(downloadId);

      const downloadResult = await downloadSurah(
        surah.id,
        reciterId,
        rewayatId,
        progress => {
          setDownloadProgress(downloadId, progress);
        },
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

      clearDownloading(downloadId);
    } catch (error) {
      console.error('Download failed:', error);
      const downloadId = rewayatId
        ? `${reciterId}-${surah.id}-${rewayatId}`
        : `${reciterId}-${surah.id}`;
      clearDownloading(downloadId);
    }
  }, [
    reciterId,
    surah.id,
    rewayatId,
    isTrackDownloaded,
    isDownloading,
    isDownloadingWithRewayat,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
  ]);

  const handleAddToCollection = useCallback(() => {
    playlistModalRef.current?.snapToIndex(0);
  }, []);

  const handleCollectionModalClose = useCallback(() => {
    playlistModalRef.current?.close();
  }, []);

  const handleToggleLoved = useCallback(() => {
    toggleLoved(reciterId, surah.id.toString(), rewayatId || '');
  }, [reciterId, surah.id, toggleLoved, rewayatId]);

  const handleGoToReciter = useCallback(() => {
    onClose();
    onGoToReciter();
  }, [onClose, onGoToReciter]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSummary(false);
    }
  }, []);

  return (
    <>
      <BaseModal
        bottomSheetRef={bottomSheetRef}
        snapPoints={showSummary ? ['80%'] : ['60%']}
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
                style={[
                  styles.option,
                  pressedOption === 'download' && styles.optionPressed,
                ]}
                onPress={handleDownload}
                onPressIn={() => setPressedOption('download')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                {(
                  rewayatId
                    ? isDownloadingWithRewayat(
                        reciterId,
                        surah.id.toString(),
                        rewayatId,
                      )
                    : isDownloading(reciterId, surah.id.toString())
                ) ? (
                  <CircularProgress
                    progress={downloadProgress}
                    size={moderateScale(20)}
                    strokeWidth={moderateScale(2.5)}
                    color={theme.colors.text}
                  />
                ) : isTrackDownloaded ? (
                  <CheckIcon
                    color={theme.colors.text}
                    size={moderateScale(20)}
                  />
                ) : (
                  <Ionicons
                    name="arrow-down"
                    size={moderateScale(20)}
                    color={theme.colors.text}
                  />
                )}
                <Text style={[styles.optionText]}>
                  {(
                    rewayatId
                      ? isDownloadingWithRewayat(
                          reciterId,
                          surah.id.toString(),
                          rewayatId,
                        )
                      : isDownloading(reciterId, surah.id.toString())
                  )
                    ? `Downloading ${Math.round(downloadProgress * 100)}%`
                    : isTrackDownloaded
                      ? 'Downloaded'
                      : 'Download'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  pressedOption === 'collection' && styles.optionPressed,
                ]}
                onPress={handleAddToCollection}
                onPressIn={() => setPressedOption('collection')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                <Icon
                  name="plus-circle"
                  type="feather"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text style={[styles.optionText]}>Add to Collection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  pressedOption === 'loved' && styles.optionPressed,
                ]}
                onPress={handleToggleLoved}
                onPressIn={() => setPressedOption('loved')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                <HeartIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={isLovedState}
                />
                <Text style={[styles.optionText]}>
                  {isLovedState ? 'Remove from Loved' : 'Add to Loved'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  pressedOption === 'reciter' && styles.optionPressed,
                ]}
                onPress={handleGoToReciter}
                onPressIn={() => setPressedOption('reciter')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                <ProfileIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={false}
                />
                <Text style={[styles.optionText]}>Go to Reciter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  pressedOption === 'info' && styles.optionPressed,
                ]}
                onPress={handleViewInfo}
                onPressIn={() => setPressedOption('info')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
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

      <SelectPlaylistModal
        bottomSheetRef={playlistModalRef}
        surah={surah}
        reciterId={reciterId}
        rewayatId={rewayatId}
        onClose={handleCollectionModalClose}
      />
    </>
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
    optionPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    optionText: {
      flex: 1,
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      marginLeft: moderateScale(12),
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(20),
    },
  });
