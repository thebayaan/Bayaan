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
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
import {CheckIcon, DownloadIcon} from '@/components/Icons';
import {useDownload} from '@/services/player/store/downloadStore';
import {downloadSurah} from '@/services/downloadService';
import {SelectPlaylistModal} from './SelectPlaylistModal';
import Color from 'color';
import {CircularProgress} from '@/components/CircularProgress';

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
  const {width} = useWindowDimensions();

  const [showSummary, setShowSummary] = useState(false);
  const [pressedOption, setPressedOption] = useState<string | null>(null);
  const playlistModalRef = React.useRef<BottomSheet>(null);

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
    // Use the provided rewayatId if available, otherwise use an empty string
    toggleLoved(reciterId, surah.id.toString(), rewayatId || '');
  }, [reciterId, surah.id, toggleLoved, rewayatId]);

  const {
    isDownloaded,
    isDownloadedWithRewayat,
    isDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    getDownloadProgress,
  } = useDownload();

  const downloadProgress = getDownloadProgress(
    reciterId || '',
    surah.id.toString(),
  );

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
      const downloadId = `${reciterId}-${surah.id}`;
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
    setDownloadProgress,
  ]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId) return;
    playlistModalRef.current?.snapToIndex(0);
  }, [reciterId]);

  const handlePlaylistModalClose = useCallback(() => {
    playlistModalRef.current?.close();
  }, []);

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
                  !reciterId && styles.optionDisabled,
                  pressedOption === 'loved' && styles.optionPressed,
                ]}
                onPress={handleToggleLove}
                onPressIn={() => setPressedOption('loved')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                <HeartIcon
                  color={theme.colors.text}
                  size={moderateScale(20)}
                  filled={isLovedState}
                />
                <Text
                  style={[
                    styles.optionText,
                    !reciterId && styles.optionTextDisabled,
                  ]}>
                  {isLovedState ? 'Remove from Loved' : 'Add to Loved'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  !reciterId && styles.optionDisabled,
                  pressedOption === 'download' && styles.optionPressed,
                ]}
                onPress={handleDownload}
                onPressIn={() => setPressedOption('download')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                {isDownloading(reciterId || '', surah.id.toString()) ? (
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
                  <DownloadIcon
                    color={theme.colors.text}
                    size={moderateScale(20)}
                  />
                )}
                <Text style={[styles.optionText]}>
                  {isDownloading(reciterId || '', surah.id.toString())
                    ? `Downloading ${Math.round(downloadProgress * 100)}%`
                    : isTrackDownloaded
                      ? 'Downloaded'
                      : 'Download'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.option,
                  !onAddToQueue && styles.optionDisabled,
                  pressedOption === 'queue' && styles.optionPressed,
                ]}
                onPress={handleAddToQueue}
                onPressIn={() => setPressedOption('queue')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
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
                style={[
                  styles.option,
                  !reciterId && styles.optionDisabled,
                  pressedOption === 'collection' && styles.optionPressed,
                ]}
                onPress={handleAddToPlaylist}
                onPressIn={() => setPressedOption('collection')}
                onPressOut={() => setPressedOption(null)}
                activeOpacity={1}>
                <Icon
                  name="plus-circle"
                  type="feather"
                  size={moderateScale(20)}
                  color={theme.colors.text}
                />
                <Text
                  style={[
                    styles.optionText,
                    !reciterId && styles.optionTextDisabled,
                  ]}>
                  Add to Collection
                </Text>
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
        reciterId={reciterId || ''}
        rewayatId={rewayatId}
        onClose={handlePlaylistModalClose}
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
    optionDisabled: {
      opacity: 0.5,
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
