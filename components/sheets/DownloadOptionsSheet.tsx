import React, {useCallback, useState, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet, Dimensions} from 'react-native';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {QueueIcon, HeartIcon, PlayIcon} from '@/components/Icons';
import {SheetProps, ScrollView} from 'react-native-actions-sheet';
import {showSheet, hideSheet} from '@/components/sheets/sheetControl'; // @ai
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import {useLoved} from '@/hooks/useLoved';
import Color from 'color';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
// @ai-start
import {useTranslation} from 'react-i18next';
import {getSurahDisplayName, getSurahMeaning} from '@/i18n/format';
import {useSheetBottomPadding} from '@/components/sheets/useSheetBottomPadding'; // @ai
// @ai-end

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
export const DownloadOptionsSheet = (props: SheetProps<'download-options'>) => {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // Size HTML from the sheet, which stops at 560pt on iPad. @ai
  const width = useSheetWidth(); // @ai
  const payload = props.payload;
  // A native menu's "Learn about this surah" opens the sheet on the info. @ai
  const [showSurahInfo, setShowSurahInfo] = useState(!!payload?.showInfo);

  const download = payload?.download;
  const surah = payload?.surah;
  const reciterId = payload?.reciterId;
  const rewayatId = payload?.rewayatId;
  const onPlay = payload?.onPlay;
  const onAddToQueue = payload?.onAddToQueue;
  const onRemoveDownload = payload?.onRemoveDownload;

  const surahId = surah?.id?.toString() ?? '';
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;

  const {isLovedWithRewayat, toggleLoved} = useLoved();

  const isLovedState =
    reciterId && rewayatId
      ? isLovedWithRewayat(reciterId, surahId, rewayatId)
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
    hideSheet('download-options');
  }, []);

  const handlePlay = useCallback(() => {
    handleClose();
    onPlay?.();
  }, [onPlay, handleClose]);

  const handleToggleLove = useCallback(() => {
    if (!reciterId) return;
    toggleLoved(reciterId, surahId, rewayatId || '');
  }, [reciterId, surahId, rewayatId, toggleLoved]);

  const handleAddToQueue = useCallback(() => {
    handleClose();
    onAddToQueue?.();
  }, [onAddToQueue, handleClose]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    showSheet('select-playlist', {
      payload: {
        surah,
        reciterId,
        rewayatId,
      },
    });
  }, [reciterId, surah, rewayatId]);

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

  const handleRemoveDownload = useCallback(() => {
    if (!download) return;
    confirmDestructive({
      title: t('downloadOptions.removeTitle'),
      message: t('downloadOptions.removeMessage'),
      confirmText: t('common:actions.remove'),
      cancelText: t('common:actions.cancel'),
      onConfirm: () => {
        handleClose();
        onRemoveDownload?.();
      },
    });
  }, [download, handleClose, onRemoveDownload, t]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  if (!surah) {
    return null;
  }

  const surahName = getSurahDisplayName(surah);
  const surahMeaning = getSurahMeaning(surah);

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
              {t('options.aboutSurah', {surah: surahName})}
            </Text>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View
              style={[styles.infoContent, {paddingBottom: sheetBottomPadding}]}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>{surahName}</Text>
                {surahMeaning ? (
                  <Text style={styles.surahInfoTranslation}>
                    {surahMeaning}
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
            <Text style={styles.surahName}>{surahName}</Text>
            {surahMeaning ? (
              <Text style={styles.surahTranslation}>{surahMeaning}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Pressable
              style={({pressed}) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
              onPress={handlePlay}>
              <PlayIcon color={theme.colors.text} size={moderateScale(18)} />
              <Text style={styles.optionText}>{t('options.playNow')}</Text>
            </Pressable>

            <View style={styles.divider} />

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
              <Text style={styles.optionText}>{t('options.addToQueue')}</Text>
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

            <View style={styles.divider} />

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
              <Text style={styles.optionText}>
                {t('options.learnAboutSurah')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.destructiveCard}>
            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
              ]}
              onPress={handleRemoveDownload}>
              <Feather
                name="trash-2"
                size={moderateScale(18)}
                color="#ff4444"
              />
              <Text style={styles.optionTextDestructive}>
                {t('downloadOptions.removeTitle')}
              </Text>
            </Pressable>
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
    rotatedIcon: {
      transform: [{rotate: '180deg'}],
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
