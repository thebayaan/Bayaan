import React, {useCallback, useState, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet, Dimensions} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {
  QueueIcon,
  HeartIcon,
  CheckIcon,
  ProfileIcon,
  LearnAboutIcon,
} from '@/components/Icons';
import {SheetProps, SheetManager, ScrollView} from 'react-native-actions-sheet';
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
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
import {getReciterByIdSync} from '@/services/dataService';
import {recitationShareUrl, shareUrl} from '@/utils/shareUtils';
import branding from '@/config/branding';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
// @ai-start
import {useTranslation} from 'react-i18next';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  getSurahMeaning,
} from '@/i18n/format';
// @ai-end

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

// @ai-start
export const SurahOptionsSheet = (props: SheetProps<'surah-options'>) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // Size HTML from the sheet, which stops at 560pt on iPad. @ai
  const width = useSheetWidth(); // @ai
  const [showSurahInfo, setShowSurahInfo] = useState(false);

  // Extract payload - these hooks only run when sheet is shown
  const payload = props.payload;
  const surah = payload?.surah;
  const reciterId = payload?.reciterId;
  const rewayatId = payload?.rewayatId;
  const onAddToQueue = payload?.onAddToQueue;
  const onRemoveFromPlaylist = payload?.onRemoveFromPlaylist;

  const surahId = surah?.id?.toString() ?? '';
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;

  const downloadId = React.useMemo(
    () =>
      reciterId
        ? rewayatId
          ? `${reciterId}-${surahId}-${rewayatId}`
          : `${reciterId}-${surahId}`
        : '__none__',
    [reciterId, surahId, rewayatId],
  );

  const {navigateToReciterProfile} = useReciterNavigation();

  // These expensive hooks now only run when sheet is actually open
  const {isLoved, isLovedWithRewayat, toggleLoved} = useLoved();
  const downloadProgress = useDownloadProgress(downloadId);
  const isTrackDownloadedBase = useIsDownloaded(
    reciterId || '__none__',
    surahId,
  );
  const isTrackDownloadedRewayat = useIsDownloadedWithRewayat(
    reciterId || '__none__',
    surahId,
    rewayatId || '',
  );
  const isTrackDownloaded = rewayatId
    ? isTrackDownloadedRewayat
    : isTrackDownloadedBase;
  const isCurrentlyDownloading = useIsDownloading(downloadId);
  const {setDownloading, addDownload, clearDownloading, setDownloadProgress} =
    useDownloadActions();

  // Calculate loved state
  const isLovedState = reciterId
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
    SheetManager.hide('surah-options');
  }, []);

  const handleAddToQueue = useCallback(() => {
    handleClose();
    if (onAddToQueue && surah) {
      onAddToQueue(surah).catch(error => {
        console.error('Error adding to queue:', error);
      });
    }
  }, [onAddToQueue, surah, handleClose]);

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

  const handleGoToReciter = useCallback(() => {
    handleClose();
    if (reciterId) {
      navigateToReciterProfile(reciterId);
    }
  }, [handleClose, reciterId, navigateToReciterProfile]);

  const handleRemoveFromPlaylist = useCallback(() => {
    handleClose();
    onRemoveFromPlaylist?.();
  }, [onRemoveFromPlaylist, handleClose]);

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

  const handleShare = useCallback(() => {
    if (!reciterId || !rewayatId || !surah) return;
    const reciter = getReciterByIdSync(reciterId);
    if (!reciter?.slug) return;
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (!rewayat) return;
    const url = recitationShareUrl(reciter.slug, surah.id, rewayat.id);
    shareUrl(
      url,
      t('options.shareListenSurah', {
        surah: getSurahDisplayName(surah),
        appName: branding.appName,
      }),
    );
  }, [reciterId, rewayatId, surah, t]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  if (!surah) {
    return null;
  }

  const headerReciter = reciterId ? getReciterByIdSync(reciterId) : undefined;
  const reciterDisplayName = headerReciter
    ? getReciterDisplayName(headerReciter)
    : reciterId && getReciterName(reciterId);

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation={showSurahInfo ? 'card' : 'menu'}
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
            <Text style={styles.headerTitle}>
              {t('options.aboutSurah', {surah: getSurahDisplayName(surah)})}
            </Text>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View style={styles.infoContent}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>
                  {getSurahDisplayName(surah)}
                </Text>
                {getSurahMeaning(surah) ? (
                  <Text style={styles.surahInfoTranslation}>
                    {getSurahMeaning(surah)}
                  </Text>
                ) : null}
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
            <Text style={styles.surahName}>{getSurahDisplayName(surah)}</Text>
            <Text style={styles.surahTranslation}>
              {reciterDisplayName || getSurahMeaning(surah)}
            </Text>
          </View>

          <View style={styles.card}>
            <Pressable
              style={({pressed}) => [
                styles.option,
                !reciterId && styles.optionDisabled,
                pressed && styles.optionPressed,
              ]}
              onPress={handleToggleLove}>
              <HeartIcon
                color={theme.colors.text}
                size={moderateScale(18)}
                filled={isLovedState}
              />
              <Text
                style={[
                  styles.optionText,
                  !reciterId && styles.optionTextDisabled,
                ]}>
                {isLovedState
                  ? t('options.removeFromLoved')
                  : t('options.addToLoved')}
              </Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({pressed}) => [
                styles.option,
                !reciterId && styles.optionDisabled,
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
              <Text style={[styles.optionText]}>
                {isCurrentlyDownloading
                  ? t('options.downloading', {
                      percent: Math.round(downloadProgress * 100),
                    })
                  : isTrackDownloaded
                    ? t('options.downloaded')
                    : t('common:actions.download')}
              </Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({pressed}) => [
                styles.option,
                !onAddToQueue && styles.optionDisabled,
                pressed && styles.optionPressed,
              ]}
              onPress={handleAddToQueue}>
              <View style={styles.rotatedIcon}>
                <QueueIcon
                  color={theme.colors.text}
                  size={moderateScale(18)}
                  filled={true}
                />
              </View>
              <Text
                style={[
                  styles.optionText,
                  !onAddToQueue && styles.optionTextDisabled,
                ]}>
                {t('options.addToQueue')}
              </Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={({pressed}) => [
                styles.option,
                !reciterId && styles.optionDisabled,
                pressed && styles.optionPressed,
              ]}
              onPress={handleAddToPlaylist}>
              <Feather
                name="plus-circle"
                size={moderateScale(18)}
                color={theme.colors.text}
              />
              <Text
                style={[
                  styles.optionText,
                  !reciterId && styles.optionTextDisabled,
                ]}>
                {t('options.addToCollection')}
              </Text>
            </Pressable>

            {reciterId && rewayatId && (
              <>
                <View style={styles.divider} />
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
                  <Text style={styles.optionText}>
                    {t('common:actions.share')}
                  </Text>
                </Pressable>
              </>
            )}

            {reciterId && !payload?.hideGoToReciter && (
              <>
                <View style={styles.divider} />
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
                  <Text style={styles.optionText}>
                    {t('options.goToReciter')}
                  </Text>
                </Pressable>
              </>
            )}

            <View style={styles.divider} />

            <Pressable
              style={({pressed}) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={handleViewInfo}>
              <LearnAboutIcon
                size={moderateScale(18)}
                color={theme.colors.text}
              />
              <Text style={styles.optionText}>
                {t('options.learnAboutSurah')}
              </Text>
            </Pressable>
          </View>

          {onRemoveFromPlaylist && (
            <View style={styles.destructiveCard}>
              <Pressable
                style={({pressed}) => [
                  styles.optionDestructive,
                  pressed && styles.optionDestructivePressed,
                ]}
                onPress={handleRemoveFromPlaylist}>
                <Feather
                  name="minus-circle"
                  size={moderateScale(18)}
                  color="#ff4444"
                />
                <Text style={styles.optionTextDestructive}>
                  {t('options.removeFromPlaylist')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </ActionSheet>
  );
};
// @ai-end

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
    destructiveCard: {
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      overflow: 'hidden',
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
    optionDisabled: {
      opacity: 0.5,
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
    optionTextDisabled: {
      color: theme.colors.textSecondary,
    },
    rotatedIcon: {
      transform: [{rotate: '180deg'}],
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
