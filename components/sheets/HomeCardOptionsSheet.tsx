import React, {useCallback} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SheetProps} from 'react-native-actions-sheet';
import {hideSheet} from '@/components/sheets/sheetControl'; // @ai
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {
  PlayIcon,
  QueueIcon,
  ProfileIcon,
  HeartIcon,
  StarIcon,
} from '@/components/Icons';
// @ai-start
import {useTranslation} from 'react-i18next';
import {
  useHomeCardOptions,
  type HomeCardOptionsPayload,
} from './options/homeCardOptions';
// @ai-end

// @ai-start
// The sheet can render before its payload arrives. Return early here, in a
// component without hooks, so the content below always calls the same hooks.
export const HomeCardOptionsSheet = (
  props: SheetProps<'home-card-options'>,
) => {
  if (!props.payload) return null;
  return (
    <HomeCardOptionsContent sheetId={props.sheetId} payload={props.payload} />
  );
};

const HomeCardOptionsContent = ({
  sheetId,
  payload,
}: {
  sheetId: string;
  payload: HomeCardOptionsPayload;
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  const handleClose = useCallback(() => {
    hideSheet('home-card-options');
  }, []);
  const {
    variant,
    title,
    subtitle,
    isFavorite,
    isLoved,
    handleContinuePlaying,
    handleAddToQueue,
    handleGoToReciter,
    handleToggleFavorite,
    handleToggleLoved,
    handleAddToPlaylist,
    handleShare,
    handleRemoveFromRecents,
  } = useHomeCardOptions(payload, handleClose);

  const iconSize = moderateScale(18);
  const iconColor = theme.colors.text;

  return (
    <ActionSheet
      id={sheetId}
      tabletPresentation="menu"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.card}>
          {variant === 'recent' && (
            <>
              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleContinuePlaying}>
                <PlayIcon color={iconColor} size={iconSize} />
                <Text style={styles.optionText}>
                  {t('homeCardOptions.continuePlaying')}
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
                  <QueueIcon color={iconColor} size={iconSize} filled={true} />
                </View>
                <Text style={styles.optionText}>
                  {t('homeCardOptions.addToQueue')}
                </Text>
              </Pressable>

              <View style={styles.divider} />
            </>
          )}

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleGoToReciter}>
            <ProfileIcon color={iconColor} size={iconSize} filled={false} />
            <Text style={styles.optionText}>
              {t('homeCardOptions.goToReciter')}
            </Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({pressed}) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
            onPress={handleToggleFavorite}>
            <StarIcon color={iconColor} size={iconSize} filled={isFavorite} />
            <Text style={styles.optionText}>
              {isFavorite
                ? t('homeCardOptions.removeReciterFromFavorites')
                : t('homeCardOptions.addReciterToFavorites')}
            </Text>
          </Pressable>

          {variant === 'recent' && (
            <>
              <View style={styles.divider} />

              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleToggleLoved}>
                <HeartIcon
                  color={iconColor}
                  size={moderateScale(22)}
                  filled={isLoved}
                />
                <Text style={styles.optionText}>
                  {isLoved
                    ? t('homeCardOptions.removeFromLoved')
                    : t('homeCardOptions.addToLoved')}
                </Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={({pressed}) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={handleAddToPlaylist}>
                <Feather name="plus-circle" size={iconSize} color={iconColor} />
                <Text style={styles.optionText}>
                  {t('homeCardOptions.addToCollection')}
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
            onPress={handleShare}>
            <Feather name="share" size={iconSize} color={iconColor} />
            <Text style={styles.optionText}>{t('common:actions.share')}</Text>
          </Pressable>
        </View>

        {variant === 'recent' && (
          <View style={styles.destructiveCard}>
            <Pressable
              style={({pressed}) => [
                styles.optionDestructive,
                pressed && styles.optionDestructivePressed,
              ]}
              onPress={handleRemoveFromRecents}>
              <Feather name="minus-circle" size={iconSize} color="#ff4444" />
              <Text style={styles.optionTextDestructive}>
                {t('homeCardOptions.removeFromRecents')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ActionSheet>
  );
};
// @ai-end

// Exported so AdhkarSessionOptionsSheet shares this sheet's look.
export const createStyles = (theme: Theme) =>
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
    rotatedIcon: {
      transform: [{rotate: '90deg'}],
    },
    destructiveCard: {
      backgroundColor: 'rgba(255, 68, 68, 0.1)',
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      marginBottom: moderateScale(8),
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
  });
