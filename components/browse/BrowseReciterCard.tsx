import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import {FollowAlongBadge} from '@/components/badges/FollowAlongBadge';
import Color from 'color';
import {GlassView} from 'expo-glass-effect';
import {Link} from 'expo-router';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
// @ai-start
import {latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {getReciterDisplayName} from '@/i18n/format';
import type {ReciterProfilePathname} from '@/hooks/useTabReciterPath'; // @ai
import {PlayIcon} from '@/components/Icons';
// @ai-end

interface BrowseReciterCardProps {
  reciter: Reciter;
  onPress: () => void;
  onLongPress?: () => void;
  width: number;
  height: number;
  theme: Theme;
  showFollowAlong?: boolean;
  rewayatId?: string;
  // @ai-start
  /**
   * When true (default) the card links to the reciter's profile. Pass false
   * when the card is a choice, such as picking a reciter for a surah, so the
   * tap calls `onPress` instead of navigating.
   */
  linkToProfile?: boolean;
  /** Profile route of the tab showing the card. Defaults to Home. */
  profilePathname?: ReciterProfilePathname;
  /**
   * iPad grid sizes: 14/12pt caption in a fixed `TABLET_CAPTION_HEIGHT`
   * band, so a card `TABLET_CAPTION_HEIGHT` taller than it is wide has
   * square art.
   */
  tabletText?: boolean;
  /** Round play badge on the art, for cards whose tap plays. */
  showPlayBadge?: boolean;
  // @ai-end
}

// @ai-start
/** Height of the caption band when `tabletText` is set. */
export const TABLET_CAPTION_HEIGHT = 52;
const PLAY_BADGE_SIZE = 32;
// @ai-end

// @ai-start
function createStyles(theme: Theme, width: number, height: number) {
  return StyleSheet.create({
    container: {
      width,
      height,
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
    },
    imageContainer: {
      width: '100%',
      flex: 1,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    contentContainer: {
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(6),
      gap: moderateScale(1),
    },
    reciterName: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      letterSpacing: latinLetterSpacing(-0.2),
      lineHeight: moderateScale(14),
      includeFontPadding: false,
    },
    reciterInfo: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      lineHeight: moderateScale(12),
      includeFontPadding: false,
      flexShrink: 1,
    },
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    glassContainer: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    tabletContent: {
      height: TABLET_CAPTION_HEIGHT,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
    },
    tabletName: {
      fontSize: 14,
      lineHeight: 18,
    },
    tabletInfo: {
      fontSize: 12,
      lineHeight: 16,
    },
    playBadge: {
      position: 'absolute',
      bottom: 8,
      end: 8,
      width: PLAY_BADGE_SIZE,
      height: PLAY_BADGE_SIZE,
      borderRadius: PLAY_BADGE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
  });
}
// @ai-end

// @ai-start
const BrowseReciterCard = React.memo(
  ({
    reciter,
    onPress,
    onLongPress,
    width,
    height,
    theme,
    rewayatId,
    showFollowAlong,
    linkToProfile = true,
    profilePathname = '/(tabs)/(a.home)/reciter/[id]', // @ai
    tabletText = false,
    showPlayBadge = false,
  }: BrowseReciterCardProps) => {
    const {t} = useTranslation('home');
    const glassColorScheme = useGlassColorScheme();
    const styles = useMemo(
      () => createStyles(theme, width, height),
      [theme, width, height],
    );

    const uniqueRewayatNames = useMemo(() => {
      const names = new Set(reciter.rewayat.map(r => r.name));
      return Array.from(names);
    }, [reciter.rewayat]);

    const content = (
      <>
        <View style={styles.imageContainer}>
          <ReciterImage
            imageUrl={reciter.image_url || undefined}
            reciterName={reciter.name}
            style={styles.image}
            profileIconSize={moderateScale(40)}
          />
          {showPlayBadge && (
            <View style={styles.playBadge} testID="play-badge">
              <PlayIcon color={theme.colors.background} size={13} />
            </View>
          )}
        </View>

        <View
          style={[styles.contentContainer, tabletText && styles.tabletContent]}>
          <Text
            style={[styles.reciterName, tabletText && styles.tabletName]}
            numberOfLines={1}>
            {getReciterDisplayName(reciter)}
          </Text>
          <View style={styles.secondaryRow}>
            <Text
              style={[styles.reciterInfo, tabletText && styles.tabletInfo]}
              numberOfLines={1}>
              {uniqueRewayatNames.length > 1
                ? t('reciterCard.rewayatAvailable', {
                    count: uniqueRewayatNames.length,
                  })
                : getDisplayLabelFromName(reciter.rewayat[0]?.name)}
            </Text>
            {showFollowAlong && <FollowAlongBadge />}
          </View>
        </View>
      </>
    );

    const linkHref = {
      pathname: profilePathname, // @ai
      params: {id: reciter.id, ...(rewayatId ? {rewayatId} : {})},
    };

    if (!linkToProfile) {
      return (
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={getReciterDisplayName(reciter)}
          style={({pressed}) =>
            USE_GLASS
              ? undefined
              : [styles.container, pressed && styles.pressed]
          }>
          {USE_GLASS ? (
            <GlassView
              style={StyleSheet.flatten([
                styles.container,
                styles.glassContainer,
              ])}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}>
              {content}
            </GlassView>
          ) : (
            content
          )}
        </Pressable>
      );
    }

    if (USE_GLASS) {
      return (
        <Link href={linkHref} asChild>
          <Pressable onLongPress={onLongPress}>
            <Link.AppleZoom>
              <GlassView
                style={StyleSheet.flatten([
                  styles.container,
                  styles.glassContainer,
                ])}
                glassEffectStyle="regular"
                colorScheme={glassColorScheme}>
                {content}
              </GlassView>
            </Link.AppleZoom>
          </Pressable>
        </Link>
      );
    }

    return (
      <Link href={linkHref} asChild>
        <Pressable onLongPress={onLongPress} style={styles.container}>
          {content}
        </Pressable>
      </Link>
    );
  },
  (prevProps, nextProps) =>
    prevProps.reciter === nextProps.reciter &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.theme === nextProps.theme &&
    prevProps.showFollowAlong === nextProps.showFollowAlong &&
    prevProps.rewayatId === nextProps.rewayatId &&
    prevProps.linkToProfile === nextProps.linkToProfile &&
    prevProps.profilePathname === nextProps.profilePathname &&
    prevProps.tabletText === nextProps.tabletText &&
    prevProps.showPlayBadge === nextProps.showPlayBadge &&
    prevProps.onLongPress === nextProps.onLongPress,
);
// @ai-end

BrowseReciterCard.displayName = 'BrowseReciterCard';

export {BrowseReciterCard};
