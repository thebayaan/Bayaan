import React, {useCallback, useState, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet, Dimensions} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {CheckIcon, ProfileIcon, HeartIcon} from '@/components/Icons';
import {SheetProps, ScrollView} from 'react-native-actions-sheet';
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import {Feather, FontAwesome5, Ionicons} from '@expo/vector-icons';
import {getReciterName} from '@/services/dataService';
import Color from 'color';
import {CircularProgress} from '@/components/CircularProgress';
import {getReciterByIdSync} from '@/services/dataService';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
import {useUploadsStore} from '@/store/uploadsStore';
// @ai-start
import {useTranslation} from 'react-i18next';
import {usePlayerOptions} from './options/playerOptions'; // @ai
import {
  getReciterDisplayName,
  getSurahDisplayName,
  getSurahMeaning,
} from '@/i18n/format';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
import {useNativeSheetId} from '@/components/native/nativeSheetContext'; // @ai
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
export const PlayerOptionsSheet = (props: SheetProps<'player-options'>) => {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const inNativeSheet = useNativeSheetId() !== null; // @ai
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // Size HTML from the sheet, which stops at 560pt on iPad. @ai
  const width = useSheetWidth(); // @ai
  const [showSurahInfo, setShowSurahInfo] = useState(!!props.payload?.showInfo); // @ai

  // Extract payload
  const payload = props.payload;
  const surah = payload?.surah;
  const reciterId = payload?.reciterId ?? '';
  const rewayatId = payload?.rewayatId;
  const onGoToReciter = payload?.onGoToReciter;
  const isUserUpload = payload?.isUserUpload ?? false;
  const userRecitationId = payload?.userRecitationId;

  const currentSurahInfo = surah ? surahInfo[surah.id] : null;

  // Get recitation data for upload header
  const recitation = userRecitationId
    ? useUploadsStore.getState().getRecitationById(userRecitationId)
    : undefined;

  const uploadHeaderTitle = useMemo(() => {
    if (!isUserUpload) return '';
    if (surah) return getSurahDisplayName(surah);
    if (recitation?.title) return recitation.title;
    if (recitation?.originalFilename) return recitation.originalFilename;
    return t('uploads.uploadedAudio');
  }, [isUserUpload, surah, recitation, t]);

  const uploadHeaderSubtitle = useMemo(() => {
    if (!isUserUpload) return '';
    if (surah) return getSurahMeaning(surah) ?? '';
    return t('uploads.upload');
  }, [isUserUpload, surah, t]);

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
    hideSheet('player-options');
  }, []);

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

  // @ai-start
  // Shared with the tablet menu (options/playerOptions.tsx).
  const {
    canLove,
    isLovedState,
    isTrackDownloaded,
    isCurrentlyDownloading,
    downloadProgress,
    handleToggleLove,
    handleDownload,
    handleAddToPlaylist,
    handleGoToReciter,
    handleEditDetails,
    handleShare,
  } = usePlayerOptions(payload, handleClose);
  // @ai-end

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  // Guard: need either a surah (system track) or upload flag
  if (!surah && !isUserUpload) {
    return null;
  }

  const headerReciter = reciterId ? getReciterByIdSync(reciterId) : undefined;
  const reciterDisplayName = headerReciter
    ? getReciterDisplayName(headerReciter)
    : reciterId && getReciterName(reciterId);

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
          <Text style={styles.optionText}>{t('options.editDetails')}</Text>
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
              ? t('options.downloading', {
                  percent: Math.round(downloadProgress * 100),
                })
              : isTrackDownloaded
                ? t('options.downloaded')
                : t('common:actions.download')}
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
          <Text style={styles.optionText}>{t('options.addToCollection')}</Text>
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
            {isLovedState
              ? t('options.removeFromLoved')
              : t('options.addToLoved')}
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
          <Text style={styles.optionText}>{t('common:actions.share')}</Text>
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
          <Text style={styles.optionText}>{t('options.goToReciter')}</Text>
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
          <Text style={styles.optionText}>{t('options.learnAboutSurah')}</Text>
        </Pressable>
      ),
    });
  }

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
              {t('options.aboutSurah', {surah: getSurahDisplayName(surah!)})}
            </Text>
          </View>
          <ScrollView
            // @ai: a fitted native sheet measures this; it scrolls there
            style={inNativeSheet ? undefined : styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View
              style={[styles.infoContent, {paddingBottom: sheetBottomPadding}]}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>
                  {getSurahDisplayName(surah!)}
                </Text>
                {getSurahMeaning(surah!) ? (
                  <Text style={styles.surahInfoTranslation}>
                    {getSurahMeaning(surah!)}
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
        <View style={[styles.container, {paddingBottom: sheetBottomPadding}]}>
          <View style={styles.header}>
            <Text style={styles.surahName} numberOfLines={1}>
              {isUserUpload ? uploadHeaderTitle : getSurahDisplayName(surah!)}
            </Text>
            <Text style={styles.surahTranslation} numberOfLines={1}>
              {isUserUpload
                ? uploadHeaderSubtitle
                : reciterDisplayName || getSurahMeaning(surah!)}
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
