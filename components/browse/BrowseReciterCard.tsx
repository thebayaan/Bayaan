import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import Color from 'color';
import {GlassView} from 'expo-glass-effect';
import {Link} from 'expo-router';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';

interface BrowseReciterCardProps {
  reciter: Reciter;
  onPress: () => void;
  onLongPress?: () => void;
  width: number;
  height: number;
  theme: Theme;
  showFollowAlong?: boolean;
  rewayatId?: string;
}

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
      letterSpacing: -0.2,
      lineHeight: moderateScale(14),
      includeFontPadding: false,
    },
    reciterInfo: {
      fontSize: moderateScale(9),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      lineHeight: moderateScale(12),
      includeFontPadding: false,
    },
    glassContainer: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
  });
}

const BrowseReciterCard = React.memo(
  ({
    reciter,
    onPress,
    onLongPress,
    width,
    height,
    theme,
    rewayatId,
  }: BrowseReciterCardProps) => {
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
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.reciterName} numberOfLines={1}>
            {reciter.name}
          </Text>
          <Text style={styles.reciterInfo} numberOfLines={1}>
            {uniqueRewayatNames.length > 1
              ? `${uniqueRewayatNames.length} rewayat available`
              : getDisplayLabelFromName(reciter.rewayat[0]?.name)}
          </Text>
        </View>
      </>
    );

    const linkHref = {
      pathname: '/(tabs)/(a.home)/reciter/[id]' as const,
      params: {id: reciter.id, ...(rewayatId ? {rewayatId} : {})},
    };

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
    prevProps.onLongPress === nextProps.onLongPress,
);

BrowseReciterCard.displayName = 'BrowseReciterCard';

export {BrowseReciterCard};
