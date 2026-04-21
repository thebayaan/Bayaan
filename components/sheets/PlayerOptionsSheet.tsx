import React, {useCallback, useState, useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {CheckIcon, ProfileIcon, HeartIcon} from '@/components/Icons';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import {Feather, FontAwesome5, Ionicons} from '@expo/vector-icons';
import {useLoved} from '@/hooks/useLoved';
import {
  useDownloadActions,
  useDownloadProgress,
  useIsDownloaded,
  useIsDownloadedWithRewayat,
  useIsDownloading,
} from '@/services/player/store/downloadSelectors';
import {downloadSurah} from '@/services/downloadService';
import {getReciterName} from '@/services/dataService';
import Color from 'color';
import {CircularProgress} from '@/components/CircularProgress';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {getReciterByIdSync} from '@/services/dataService';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
import {useUploadsStore} from '@/store/uploadsStore';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

export const PlayerOptionsSheet = (props: SheetProps<'player-options'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {width} = useWindowDimensions();
  const [showSurahInfo, setShowSurahInfo] = useState(false);

  // Extract payload
  const payload = props.payload;
  const surah = payload?.surah;
  const reciterId = payload?.reciterId ?? '';
  const rewayatId = payload?.rewayatId;
  const onGoToReciter = payload?.onGoToReciter;
  const isUserUpload = payload?.isUserUpload ?? false;
  const userRecitationId = payload?.userRecitationId;

  const surahId = surah?.id?.toString() ?? '';
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;

  // Get recitation data for upload header
  const recitation = userRecitationId
    ? useUploadsStore.getState().getRecitationById(userRecitationId)
    : undefined;

  const uploadHeaderTitle = useMemo(() => {
    if (!isUserUpload) return '';
    if (surah) return surah.name;
    if (recitation?.title) return recitation.title;
    if (recitation?.originalFilename) return recitation.originalFilename;
    return 'Uploaded Audio';
  }, [isUserUpload, surah, recitation]);

  const uploadHeaderSubtitle = useMemo(() => {
    if (!isUserUpload) return '';
    if (surah) return surah.translated_name_english;
    return 'Upload';
  }, [isUserUpload, surah]);

  const downloadId = React.useMemo(
    () =>
      rewayatId
        ? `${reciterId}-${surahId}-${rewayatId}`
        : `${reciterId}-${surahId}`,
    [reciterId, surahId, rewayatId],
  );

  // Hooks for download and loved state
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const downloadProgress = useDownloadProgress(downloadId);
  const isTrackDownloadedBase = useIsDownloaded(reciterId, surahId);
  const isTrackDownloadedRewayat = useIsDownloadedWithRewayat(
    reciterId,
    surahId,
    rewayatId || '',
  );
  const isTrackDownloaded = rewayatId
    ? isTrackDownloadedRewayat
    : isTrackDownloadedBase;
  const isCurrentlyDownloading = useIsDownloading(downloadId);
  const {setDownloading, addDownload, clearDownloading, setDownloadProgress} =
    useDownloadActions();

  // Calculate loved state — only meaningful when reciterId + surahId exist
  const canLove = !!reciterId && !!surahId;
  const isLovedState = canLove
    ? rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
      : isLoved(reciterId, surahId)
    : false;

  const tagsStyles = useMemo(
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

  const handleClose = useCallback(() => {
    SheetManager.hide('player-options');
  }, []);

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

  const handleToggleLove = useCallback(() => {
    if (!reciterId) return;
    toggleLoved(reciterId, surahId, rewayatId || '');
  }, [reciterId, surahId, toggleLoved, rewayatId]);

  const handleDownload = useCallback(async () => {
    if (!reciterId || !surah) return;

    if (isTrackDownloaded) {
      console.log('Track already downloaded');
      return;
    }

    if (isCurrentlyDownloading) {
      console.log('Track is already downloading');
      return;
    }

    try {
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
        surahId: surahId,
        rewayatId: rewayatId || '',
        filePath: downloadResult.filePath,
        fileSize: downloadResult.fileSize,
        downloadDate: Date.now(),
        status: 'completed',
      });

      clearDownloading(downloadId);
    } catch (error) {
      console.error('Download failed:', error);
      clearDownloading(downloadId);
    }
  }, [
    reciterId,
    surah,
    surahId,
    rewayatId,
    isTrackDownloaded,
    isCurrentlyDownloading,
    setDownloading,
    addDownload,
    clearDownloading,
    setDownloadProgress,
    downloadId,
  ]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    SheetManager.show('select-playlist', {
      payload: {
        surah,
        reciterId,
        rewayatId,
      },
    });
  }, [reciterId, surah, rewayatId]);

  const handleGoToReciter = useCallback(() => {
    handleClose();
    if (onGoToReciter) {
      onGoToReciter();
    }
  }, [handleClose, onGoToReciter]);

  const handleEditDetails = useCallback(() => {
    if (!userRecitationId) return;
    const rec = useUploadsStore.getState().getRecitationById(userRecitationId);
    if (!rec) return;
    handleClose();
    setTimeout(() => {
      SheetManager.show('organize-recitation', {
        payload: {recitation: rec},
      });
    }, 300);
  }, [userRecitationId, handleClose]);

  const handleShare = useCallback(() => {
    if (!reciterId || !rewayatId || !surah) return;
    const reciter = getReciterByIdSync(reciterId);
    if (!reciter?.slug) return;
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (!rewayat) return;
    const surahNum = surah.id;
    const position = usePlayerStore.getState().playback.position;
    const timestampSec = position > 0 ? Math.floor(position) : undefined;
    const url = recitationShareUrl(
      reciter.slug,
      surahNum,
      rewayat.id,
      timestampSec,
    );
    shareUrl(url, `Listen to Surah ${surahNum} on Bayaan`);
  }, [reciterId, rewayatId, surah]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  // Guard: need either a surah (system track) or upload flag
  if (!surah && !isUserUpload) {
    return null;
  }

  // Determine which options to show
  const showEditDetails = isUserUpload;
  const showDownload = !isUserUpload;
  const showAddToCollection = !!surah && !!reciterId;
  const showLove = canLove;
  const showGoToReciter = !!onGoToReciter;
  const showLearnAboutSurah = !!surah;

  // Build option entries for the card
  const optionEntries: {key: string; render: () => React.ReactNode}[] = [];

  if (showEditDetails) {
    optionEntries.push({
      key: 'edit',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleEditDetails}>
          <FontAwesome5
            name="sliders-h"
            size={moderateScale(16)}
            color={theme.colors.text}
          />
          <Text style={styles.optionText}>Edit Details</Text>
        </Pressable>
      ),
    });
  }

  if (showDownload) {
    optionEntries.push({
      key: 'download',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleDownload}>
          {isCurrentlyDownloading ? (
            <CircularProgress
              progress={downloadProgress}
              size={moderateScale(18)}
              strokeWidth={moderateScale(2.5)}
              color={theme.colors.text}
            />
          ) : isTrackDownloaded ? (
            <CheckIcon color={theme.colors.text} size={moderateScale(18)} />
          ) : (
            <Ionicons
              name="arrow-down"
              size={moderateScale(18)}
              color={theme.colors.text}
            />
          )}
          <Text style={styles.optionText}>
            {isCurrentlyDownloading
              ? `Downloading ${Math.round(downloadProgress * 100)}%`
              : isTrackDownloaded
                ? 'Downloaded'
                : 'Download'}
          </Text>
        </Pressable>
      ),
    });
  }

  if (showAddToCollection) {
    optionEntries.push({
      key: 'collection',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleAddToPlaylist}>
          <Feather
            name="plus-circle"
            size={moderateScale(18)}
            color={theme.colors.text}
          />
          <Text style={styles.optionText}>Add to Collection</Text>
        </Pressable>
      ),
    });
  }

  if (showLove) {
    optionEntries.push({
      key: 'love',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleToggleLove}>
          <HeartIcon
            color={theme.colors.text}
            size={moderateScale(18)}
            filled={isLovedState}
          />
          <Text style={styles.optionText}>
            {isLovedState ? 'Remove from Loved' : 'Add to Loved'}
          </Text>
        </Pressable>
      ),
    });
  }

  if (!!reciterId && !!rewayatId && !!surah) {
    optionEntries.push({
      key: 'share',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleShare}>
          <Feather
            name="share"
            size={moderateScale(18)}
            color={theme.colors.text}
          />
          <Text style={styles.optionText}>Share</Text>
        </Pressable>
      ),
    });
  }

  if (showGoToReciter) {
    optionEntries.push({
      key: 'reciter',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleGoToReciter}>
          <ProfileIcon
            color={theme.colors.text}
            size={moderateScale(18)}
            filled={false}
          />
          <Text style={styles.optionText}>Go to Reciter</Text>
        </Pressable>
      ),
    });
  }

  if (showLearnAboutSurah) {
    optionEntries.push({
      key: 'info',
      render: () => (
        <Pressable
          style={({pressed}) => [
            styles.option,
            pressed && styles.optionPressed,
          ]}
          onPress={handleViewInfo}>
          <Feather
            name="info"
            size={moderateScale(18)}
            color={theme.colors.text}
          />
          <Text style={styles.optionText}>Learn About Surah</Text>
        </Pressable>
      ),
    });
  }

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={[
        styles.sheetContainer,
        showSurahInfo && styles.sheetContainerExpanded,
      ]}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      onChange={handleSheetChange}>
      {showSurahInfo ? (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>About {surah!.name}</Text>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View style={styles.infoContent}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>{surah!.name}</Text>
                <Text style={styles.surahInfoTranslation}>
                  {surah!.translated_name_english}
                </Text>
              </View>
              {currentSurahInfo && (
                <RenderHtml
                  {...renderHtmlDefaultProps}
                  contentWidth={width - moderateScale(72)}
                  source={{html: `<div>${currentSurahInfo.text}</div>`}}
                  tagsStyles={tagsStyles}
                />
              )}
            </View>
          </ScrollView>
        </>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.surahName} numberOfLines={1}>
              {isUserUpload ? uploadHeaderTitle : surah!.name}
            </Text>
            <Text style={styles.surahTranslation} numberOfLines={1}>
              {isUserUpload
                ? uploadHeaderSubtitle
                : (reciterId && getReciterName(reciterId)) ||
                  surah!.translated_name_english}
            </Text>
          </View>

          <View style={styles.card}>
            {optionEntries.map((entry, idx) => (
              <React.Fragment key={entry.key}>
                {idx > 0 && <View style={styles.divider} />}
                {entry.render()}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
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
    sheetContainerExpanded: {
      height: SCREEN_HEIGHT * 0.85,
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
    surahName: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahTranslation: {
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
    // Surah Info styles
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    scrollView: {
      flex: 1,
    },
    infoContent: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    surahInfoHeader: {
      alignItems: 'center',
      marginVertical: moderateScale(16),
      gap: moderateScale(4),
    },
    surahInfoName: {
      fontSize: moderateScale(24),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    surahInfoTranslation: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: moderateScale(16),
    },
  });
