// @ai-generated
import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Link} from 'expo-router';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {ReciterImage} from '@/components/ReciterImage';
import {DownloadIcon, PlayIcon, ShuffleIcon} from '@/components/Icons';
import {CircularProgress} from '@/components/CircularProgress';
import {getReciterDisplayName} from '@/i18n/format';
import {latinLetterSpacing} from '@/utils/rtl';
import type {Reciter} from '@/data/reciterData';
import type {Theme} from '@/utils/themeUtils';
import type {ActionButtonsProps} from '@/components/reciter-profile/types';
import {countUniqueSurahs} from './ReciterHeader';

const GOLD_COLOR = '#FFD700';
/** Windows this wide use the `expanded` hero (ipad-standards §2, §10.2). */
const EXPANDED_MIN_WIDTH = 900;

interface TabletReciterHeroProps extends ActionButtonsProps {
  reciter: Reciter;
  /** Top padding, which depends on the header style (see ReciterHeader). */
  paddingTop: number;
  /** Page margin, so the hero lines up with the table below it. */
  margin: number;
}

/**
 * The reciter page header on iPad (mockup L9): a large round photo beside
 * the name, then Play all, Shuffle, and round Favorite and Download buttons.
 * It replaces ReciterHeader and ActionButtons on tablets; phones keep those.
 */
export function TabletReciterHero({
  reciter,
  paddingTop,
  margin,
  onPlayPress,
  onShufflePress,
  onFavoritePress,
  isFavoriteReciter,
  onDownloadAllPress,
  isDownloadingAll = false,
  downloadAllProgress = 0,
  allDownloaded = false,
}: TabletReciterHeroProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['player', 'common']);
  const {width} = useResponsive();
  const photoSize = width >= EXPANDED_MIN_WIDTH ? 240 : 200;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const surahCount = useMemo(() => countUniqueSurahs(reciter), [reciter]);
  const metaParts: string[] = [];
  if (surahCount > 0) {
    metaParts.push(t('reciterProfile.surahCount', {count: surahCount}));
  }
  if (reciter.rewayat.length > 0) {
    metaParts.push(
      t('reciterProfile.rewayatCount', {count: reciter.rewayat.length}),
    );
  }

  const photo = (
    <View>
      <ReciterImage
        reciterName={reciter.name}
        imageUrl={reciter.image_url || undefined}
        style={{
          width: photoSize,
          height: photoSize,
          borderRadius: photoSize / 2,
        }}
        profileIconSize={photoSize * 0.3}
      />
    </View>
  );

  const downloadLabel = allDownloaded
    ? t('player:reciterProfile.downloaded')
    : t('common:actions.download');

  return (
    <View style={[styles.container, {paddingTop, paddingHorizontal: margin}]}>
      {USE_GLASS ? <Link.AppleZoomTarget>{photo}</Link.AppleZoomTarget> : photo}
      <View style={styles.details}>
        <Text style={styles.overline}>{t('common:terms.reciter')}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {getReciterDisplayName(reciter)}
        </Text>
        {metaParts.length > 0 && (
          <Text style={styles.meta} numberOfLines={1}>
            {metaParts.join(' · ')}
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable
            style={({pressed}) => [
              styles.pill,
              styles.playPill,
              pressed && styles.pressed,
            ]}
            onPress={onPlayPress}
            accessibilityRole="button">
            <PlayIcon color={theme.colors.background} size={15} />
            <Text style={[styles.pillText, styles.playText]}>
              {t('player:reciterProfile.playAll')}
            </Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [
              styles.pill,
              styles.outlinePill,
              pressed && styles.pressed,
            ]}
            onPress={onShufflePress}
            accessibilityRole="button">
            <ShuffleIcon color={theme.colors.text} size={15} />
            <Text style={styles.pillText}>{t('common:actions.shuffle')}</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [styles.circle, pressed && styles.pressed]}
            onPress={onFavoritePress}
            accessibilityRole="button"
            accessibilityLabel={t('player:reciterProfile.favorite')}
            accessibilityState={{selected: isFavoriteReciter}}>
            <Ionicons
              name={isFavoriteReciter ? 'star' : 'star-outline'}
              size={20}
              color={isFavoriteReciter ? GOLD_COLOR : theme.colors.text}
            />
          </Pressable>
          {onDownloadAllPress && (
            <Pressable
              style={({pressed}) => [styles.circle, pressed && styles.pressed]}
              onPress={onDownloadAllPress}
              accessibilityRole="button"
              accessibilityLabel={downloadLabel}
              accessibilityValue={
                isDownloadingAll
                  ? {
                      min: 0,
                      max: 100,
                      now: Math.round(downloadAllProgress * 100),
                    }
                  : undefined
              }>
              {isDownloadingAll ? (
                <CircularProgress
                  progress={downloadAllProgress}
                  size={20}
                  strokeWidth={2}
                  color={theme.colors.text}
                />
              ) : allDownloaded ? (
                <Ionicons
                  name="arrow-down-circle"
                  size={21}
                  color={theme.colors.text}
                />
              ) : (
                <DownloadIcon color={theme.colors.text} size={19} />
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => {
  const faint = Color(theme.colors.text).alpha(0.06).toString();
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 28,
      paddingBottom: 20,
      backgroundColor: theme.colors.background,
    },
    details: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    overline: {
      fontSize: 12,
      fontFamily: theme.fonts.bold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: latinLetterSpacing(0.8),
    },
    name: {
      fontSize: 34,
      lineHeight: 40,
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.text,
      letterSpacing: latinLetterSpacing(-0.5),
    },
    meta: {
      fontSize: 13,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    },
    pill: {
      height: 44,
      paddingHorizontal: 20,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    playPill: {
      minWidth: 140,
      backgroundColor: theme.colors.text,
    },
    outlinePill: {
      borderWidth: 1.5,
      borderColor: Color(theme.colors.text).alpha(0.16).toString(),
    },
    pillText: {
      fontSize: 15,
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    playText: {
      color: theme.colors.background,
    },
    circle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: faint,
    },
    pressed: {
      opacity: 0.7,
    },
  });
};
