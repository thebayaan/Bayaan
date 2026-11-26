// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, Text, View, useWindowDimensions} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';

/** Side padding and gap of the Collection grids. */
export const GRID_PADDING = moderateScale(16); // iOS list margin, same as the panels
export const GRID_GAP = moderateScale(12);

/** The width of one tile when `columns` tiles share the screen. */
export function useGridTileWidth(columns: number): number {
  const {width} = useWindowDimensions();
  return Math.floor(
    (width - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns,
  );
}

/** A square of artwork with a title and a line under it. */
export function CollectionGridTile({
  art,
  title,
  subtitle,
  width,
  onPress,
  onLongPress,
  accessory,
}: {
  art: React.ReactNode;
  title: string;
  subtitle?: string;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Drawn over the artwork's corner, e.g. a now-playing mark. */
  accessory?: React.ReactNode;
}) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({pressed}) => [{width}, pressed && styles.pressed]}>
      <View>
        {art}
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    pressed: {opacity: 0.7},
    accessory: {position: 'absolute', top: '6@ms', end: '6@ms'},
    title: {
      marginTop: '7@ms',
      fontSize: '13@ms',
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    subtitle: {
      marginTop: '1@ms',
      fontSize: '11.5@ms',
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
  });
