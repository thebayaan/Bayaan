import React, {useMemo} from 'react';
import {View, Text} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {useTranslation} from 'react-i18next';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {ReciterImage} from '@/components/ReciterImage';
import {ReciterHeaderProps} from '@/components/reciter-profile/types';
import {Link} from 'expo-router';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {Reciter} from '@/data/reciterData';
// @ai-start
import {getReciterDisplayName} from '@/i18n/format';
// @ai-end

function countUniqueSurahs(reciter: Reciter): number {
  const ids = new Set<number>();
  for (const rewayah of reciter.rewayat) {
    for (const id of rewayah.surah_list) {
      if (id != null) ids.add(id);
    }
  }
  return ids.size;
}

// @ai-start
export const ReciterHeader: React.FC<ReciterHeaderProps> = ({
  reciter,
  showSearch,
  insets,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('player');
  const styles = createStyles(theme);

  const surahCount = useMemo(() => countUniqueSurahs(reciter), [reciter]);
  const rewayatCount = reciter.rewayat.length;
  const metaParts: string[] = [];
  if (surahCount > 0) {
    metaParts.push(t('reciterProfile.surahCount', {count: surahCount}));
  }
  if (rewayatCount > 0) {
    metaParts.push(t('reciterProfile.rewayatCount', {count: rewayatCount}));
  }

  const topPadding = showSearch
    ? moderateScale(15)
    : USE_GLASS
    ? moderateScale(8)
    : insets.top + moderateScale(50);

  const image = (
    <View>
      <ReciterImage
        reciterName={reciter.name}
        imageUrl={reciter.image_url || undefined}
        style={styles.reciterImage}
        profileIconSize={moderateScale(24)}
      />
    </View>
  );

  return (
    <View style={[styles.container, {paddingTop: topPadding}]}>
      <View style={styles.metaRow}>
        {USE_GLASS ? (
          <Link.AppleZoomTarget>{image}</Link.AppleZoomTarget>
        ) : (
          image
        )}
        {metaParts.length > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaParts.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.reciterName} numberOfLines={3}>
        {getReciterDisplayName(reciter)}
      </Text>
    </View>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      alignItems: 'flex-start',
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(4),
      backgroundColor: theme.colors.background,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(10),
    },
    reciterImage: {
      width: moderateScale(48),
      height: moderateScale(48),
      borderRadius: moderateScale(12),
    },
    meta: {
      flexShrink: 1,
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
    },
    reciterName: {
      fontSize: moderateScale(32),
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.text,
      lineHeight: moderateScale(38),
      letterSpacing: -0.5,
      marginTop: moderateScale(14),
    },
  });
