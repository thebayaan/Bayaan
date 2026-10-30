import React, {useCallback, useState, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet, Dimensions} from 'react-native';
import {confirmDestructive} from '@/utils/confirmDestructive'; // @ai
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {QueueIcon, HeartIcon, PlayIcon, ProfileIcon} from '@/components/Icons';
import {SheetProps, SheetManager, ScrollView} from 'react-native-actions-sheet';
import {showSheet, hideSheet} from '@/components/sheets/sheetControl'; // @ai
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useUploadsStore, getCustomReciterName} from '@/store/uploadsStore';
// @ai-start
import {
  getSurahById,
  getReciterName,
  getReciterByIdSync,
} from '@/services/dataService';
// @ai-end
import {useLoved} from '@/hooks/useLoved';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import type {UploadedRecitation} from '@/types/uploads';
import RenderHtml, {
  MixedStyleDeclaration,
  RenderHTMLProps,
  defaultSystemFonts,
} from 'react-native-render-html';
// @ai-start
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  getSurahMeaning,
  localizeDigits,
} from '@/i18n/format';
import {getUploadDisplayTitle} from './options/uploadOptions';
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

const getDisplayTitle = getUploadDisplayTitle; // @ai

// @ai-start
function getDisplaySubtitle(item: UploadedRecitation): string {
  const parts: string[] = [];

  if (item.reciterId) {
    const reciter = getReciterByIdSync(item.reciterId);
    const name = reciter
      ? getReciterDisplayName(reciter)
      : getReciterName(item.reciterId);
    if (name) parts.push(name);
  } else if (item.customReciterId) {
    const name = getCustomReciterName(item.customReciterId);
    if (name) parts.push(name);
  }

  if (item.type === null) {
    parts.push(i18n.t('sheets:uploads.untagged'));
  } else if (item.type === 'other' && item.category) {
    const fallback =
      item.category.charAt(0).toUpperCase() + item.category.slice(1);
    parts.push(
      i18n.t(`sheets:uploads.categories.${item.category}`, {
        defaultValue: fallback,
      }),
    );
  }

  if (item.startVerse != null) {
    if (item.endVerse != null) {
      parts.push(
        i18n.t('sheets:uploads.versesRange', {
          from: item.startVerse,
          to: item.endVerse,
        }),
      );
    } else {
      parts.push(i18n.t('sheets:uploads.verse', {verse: item.startVerse}));
    }
  }

  if (item.recordingType === 'salah') {
    parts.push(i18n.t('sheets:uploads.salah'));
  } else if (item.recordingType === 'studio') {
    parts.push(i18n.t('sheets:uploads.studio'));
  }

  if (item.duration !== null) {
    const mins = Math.floor(item.duration / 60);
    const secs = Math.floor(item.duration % 60);
    parts.push(localizeDigits(`${mins}:${secs.toString().padStart(2, '0')}`));
  }

  return parts.join(' \u00B7 ');
}
// @ai-end

// @ai-start
export const UploadOptionsSheet = (props: SheetProps<'upload-options'>) => {
  const {theme} = useTheme();
  const sheetBottomPadding = useSheetBottomPadding(moderateScale(40)); // @ai
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  // Size HTML from the sheet, which stops at 560pt on iPad. @ai
  const width = useSheetWidth(); // @ai
  // A native menu's "Learn about this surah" opens the sheet on the info. @ai
  const [showSurahInfo, setShowSurahInfo] = useState(!!props.payload?.showInfo);

  const {deleteRecitation} = useUploadsStore();
  const {isLovedWithRewayat, toggleLoved} = useLoved();
  const {navigateToReciterProfile} = useReciterNavigation();

  const payload = props.payload;
  const recitation = payload?.recitation;
  const reciterId = payload?.reciterId;
  const onPlay = payload?.onPlay;
  const onAddToQueue = payload?.onAddToQueue;

  const surahNumber = recitation?.surahNumber;
  const surah = surahNumber ? getSurahById(surahNumber) : null;
  const surahId = surah?.id?.toString() ?? '';
  const currentSurahInfo = surah ? surahInfo[surah.id] : null;
  const hasSurah = !!surah;
  const hasReciter = !!reciterId;

  const isLovedState =
    hasSurah && hasReciter
      ? isLovedWithRewayat(reciterId!, surahId, '')
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
    hideSheet('upload-options');
  }, []);

  const handlePlay = useCallback(() => {
    handleClose();
    onPlay?.();
  }, [onPlay, handleClose]);

  const handleOrganize = useCallback(() => {
    if (!recitation) return;
    handleClose();
    setTimeout(() => {
      SheetManager.show('organize-recitation', {
        payload: {recitation, prefillReciterId: reciterId},
      });
    }, 300);
  }, [recitation, reciterId, handleClose]);

  const handleAddToQueue = useCallback(() => {
    handleClose();
    onAddToQueue?.();
  }, [onAddToQueue, handleClose]);

  const handleToggleLove = useCallback(() => {
    if (!reciterId || !surahId) return;
    toggleLoved(reciterId, surahId, '', recitation?.id);
  }, [reciterId, surahId, toggleLoved, recitation?.id]);

  const handleAddToPlaylist = useCallback(() => {
    if (!reciterId || !surah) return;
    showSheet('select-playlist', {
      payload: {
        surah,
        reciterId,
        rewayatId: undefined,
        userRecitationId: recitation?.id,
      },
    });
  }, [reciterId, surah, recitation?.id]);

  const handleGoToReciter = useCallback(() => {
    handleClose();
    if (reciterId) {
      navigateToReciterProfile(reciterId);
    }
  }, [handleClose, reciterId, navigateToReciterProfile]);

  const handleViewInfo = useCallback(() => {
    setShowSurahInfo(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!recitation) return;
    const title = getDisplayTitle(recitation);
    confirmDestructive({
      title: t('uploads.deleteTitle'),
      message: t('uploads.deleteMessage', {title}),
      confirmText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
      onConfirm: () => {
        handleClose();
        deleteRecitation(recitation.id);
      },
    });
  }, [recitation, handleClose, deleteRecitation, t]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setShowSurahInfo(false);
    }
  }, []);

  if (!recitation) {
    return null;
  }

  const title = getDisplayTitle(recitation);
  const subtitle = getDisplaySubtitle(recitation);

  // Build option entries for the grouped card
  const optionEntries: {key: string; render: () => React.ReactNode}[] = [];

  optionEntries.push({
    key: 'play',
    render: () => (
      <Pressable
        style={({pressed}) => [styles.option, pressed && styles.optionPressed]}
        onPress={handlePlay}>
        <PlayIcon color={theme.colors.text} size={moderateScale(18)} />
        <Text style={styles.optionText}>{t('options.playNow')}</Text>
      </Pressable>
    ),
  });

  optionEntries.push({
    key: 'organize',
    render: () => (
      <Pressable
        style={({pressed}) => [styles.option, pressed && styles.optionPressed]}
        onPress={handleOrganize}>
        <Feather
          name="sliders"
          size={moderateScale(18)}
          color={theme.colors.text}
        />
        <Text style={styles.optionText}>{t('options.editDetails')}</Text>
      </Pressable>
    ),
  });

  optionEntries.push({
    key: 'queue',
    render: () => (
      <Pressable
        style={({pressed}) => [styles.option, pressed && styles.optionPressed]}
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
    ),
  });

  if (hasSurah && hasReciter) {
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

  if (hasReciter) {
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

  if (hasSurah) {
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
              {t('options.aboutSurah', {
                surah: surah ? getSurahDisplayName(surah) : '',
              })}
            </Text>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={true}>
            <View
              style={[styles.infoContent, {paddingBottom: sheetBottomPadding}]}>
              <View style={styles.surahInfoHeader}>
                <Text style={styles.surahInfoName}>
                  {surah ? getSurahDisplayName(surah) : ''}
                </Text>
                {surah && getSurahMeaning(surah) ? (
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
        <View style={[styles.container, {paddingBottom: sheetBottomPadding}]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            {optionEntries.map((entry, idx) => (
              <React.Fragment key={entry.key}>
                {idx > 0 && <View style={styles.divider} />}
                {entry.render()}
              </React.Fragment>
            ))}
          </View>

          <View style={styles.destructiveCard}>
            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
              ]}
              onPress={handleDelete}>
              <Feather
                name="trash-2"
                size={moderateScale(18)}
                color="#ff4444"
              />
              <Text style={styles.optionTextDestructive}>
                {t('common:actions.delete')}
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
