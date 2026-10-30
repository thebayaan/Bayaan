// @ai-generated
import React, {useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale} from '@/utils/scale';
import type {Reciter} from '@/data/reciterData';
import {ReciterImage} from '@/components/ReciterImage';
import {getReciterDisplayName} from '@/i18n/format';
import {completeRewayat} from './reciterSections';

interface Props {
  reciters: Reciter[];
  columns: number;
  currentId: string;
  isFirst: boolean;
  isLast: boolean;
  onPick: (reciter: Reciter) => void;
}

/**
 * One list row. With one column the rows of a section join into an inset
 * card; with more, each reciter is its own tile.
 */
export const ReciterGridRow = React.memo(function ReciterGridRow({
  reciters,
  columns,
  currentId,
  isFirst,
  isLast,
  onPick,
}: Props) {
  const {theme} = useTheme();
  const {t} = useTranslation('settings');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const grouped = columns === 1;

  return (
    <View style={[styles.row, !grouped && styles.gridRow]}>
      {Array.from({length: columns}, (_, i) => {
        const reciter = reciters[i];
        if (!reciter) return <View key={i} style={styles.cell} />;
        const current = reciter.id === currentId;
        const count = completeRewayat(reciter).length;
        return (
          <Pressable
            key={reciter.id}
            onPress={() => onPick(reciter)}
            accessibilityRole="button"
            accessibilityState={{selected: current}}
            style={({pressed}) => [
              styles.cell,
              grouped ? styles.groupedCell : styles.tile,
              grouped && isFirst && styles.first,
              grouped && isLast && styles.last,
              pressed && styles.pressed,
            ]}>
            <ReciterImage
              imageUrl={reciter.image_url || undefined}
              reciterName={reciter.name}
              style={styles.avatar}
            />
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {getReciterDisplayName(reciter)}
              </Text>
              <Text style={styles.sub}>
                {t('defaultReciter.recitationCount', {count})}
              </Text>
            </View>
            {current && (
              <View style={styles.check}>
                <Feather
                  name="check"
                  size={moderateScale(14)}
                  color={theme.colors.background}
                />
              </View>
            )}
            {grouped && !isFirst && <View style={styles.separator} />}
          </Pressable>
        );
      })}
    </View>
  );
});

export const ROW_HEIGHT = moderateScale(66);

const createStyles = (theme: Theme) => {
  const text = Color(theme.colors.text);
  const surface = theme.isDarkMode
    ? text.alpha(0.07).toString()
    : 'rgba(255,255,255,0.55)';
  const radius = moderateScale(24);
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
    },
    gridRow: {
      gap: moderateScale(10),
      marginBottom: moderateScale(10),
    },
    cell: {
      flex: 1,
      minWidth: 0,
    },
    groupedCell: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      backgroundColor: surface,
    },
    tile: {
      height: ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(20),
      backgroundColor: surface,
    },
    first: {
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
    },
    last: {
      borderBottomLeftRadius: radius,
      borderBottomRightRadius: radius,
    },
    separator: {
      position: 'absolute',
      top: 0,
      start: moderateScale(16 + 44 + 12),
      end: moderateScale(16),
      height: StyleSheet.hairlineWidth,
      backgroundColor: text.alpha(0.14).toString(),
    },
    avatar: {
      width: moderateScale(44),
      height: moderateScale(44),
      borderRadius: moderateScale(22),
    },
    text: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      fontSize: moderateScale(16),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      textAlign: 'left',
    },
    sub: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.regular,
      color: text.alpha(0.6).toString(),
      textAlign: 'left',
    },
    check: {
      width: moderateScale(26),
      height: moderateScale(26),
      borderRadius: moderateScale(13),
      backgroundColor: theme.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
  });
};
