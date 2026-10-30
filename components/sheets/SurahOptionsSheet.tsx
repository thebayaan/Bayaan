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
import {getReciterName} from '@/services/dataService';
import Color from 'color';
import {CircularProgress} from '@/components/CircularProgress';
import {getReciterByIdSync} from '@/services/dataService';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
// @ai-start
import {useTranslation} from 'react-i18next';
import {useSurahOptions} from './options/surahOptions'; // @ai
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
  const payload = props.payload;
  const [showSurahInfo, setShowSurahInfo] = useState(!!payload?.showInfo); // @ai
  const surah = payload?.surah;
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;

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

  // @ai-start
  // Shared with the tablet menu (options/surahOptions.tsx).
  const {
    reciterId,
    isLovedState,
    isTrackDownloaded,
    isCurrentlyDownloading,
    downloadProgress,
    handleAddToQueue,
    handleToggleLove,
    handleDownload,
    handleGoToReciter,
    handleRemoveFromPlaylist,
    handleAddToPlaylist,
    handleShare,
  } = useSurahOptions(payload, handleClose);
  const rewayatId = payload?.rewayatId;
  const onAddToQueue = payload?.onAddToQueue;
  const onRemoveFromPlaylist = payload?.onRemoveFromPlaylist;
  // @ai-end

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

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
