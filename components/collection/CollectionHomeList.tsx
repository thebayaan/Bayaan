// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from '@/utils/scale';
// @ai-start
import {
  GROUPED_CARD_RADIUS,
  GROUPED_HEADER_GAP,
  SETTINGS_ROW_INSET,
  groupedCardColor,
  groupedHeaderStyle,
  groupedSeparatorColor,
} from '@/components/settings/SettingsList';
// @ai-end
import {Theme} from '@/utils/themeUtils';
import {flipX} from '@/utils/rtl';
import type {CollectionCategory} from '@/components/collection/TabletCollectionHome';
import {
  CollectionPreview,
  type CollectionCategoryId,
  type CollectionPreviewData,
} from '@/components/collection/CollectionArt';

/** A category row on the phone Collection tab: the shared category plus a
 *  live summary of what's inside and the newest thing in it, drawn in
 *  place of an icon. */
export interface CollectionHomeCategory extends CollectionCategory {
  summary?: string;
  previewData?: CollectionPreviewData;
}

/** How the rows are grouped, in the same way as the Reading sheet's sections. */
const GROUPS: Array<{key: 'listening' | 'reading' | 'yours'; ids: string[]}> = [
  {key: 'listening', ids: ['loved', 'playlists', 'downloads']},
  {key: 'reading', ids: ['bookmarks', 'notes']},
  {key: 'yours', ids: ['reciters', 'uploads']},
];

interface CollectionHomeListProps {
  categories: CollectionHomeCategory[];
  onAdd: () => void;
  /** The live search field, shown in place of the pill while searching. */
  search?: React.ReactNode;
  /** Shown instead of the categories while searching. */
  results?: React.ReactNode;
  /** Searching: the field replaces the pill and the + button. */
  searching?: boolean;
  /** Tapping the search pill. */
  onStartSearch?: () => void;
}

/**
 * The Collection tab on phones: a search pill with an add button, then the
 * categories grouped under grey labels (Listening, Reading, Yours), each
 * group in one rounded card. Each row keeps today's tinted icon and says
 * what's inside instead of only how many items there are.
 */
export function CollectionHomeList({
  categories,
  onAdd,
  search,
  results,
  searching,
  onStartSearch,
}: CollectionHomeListProps) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const {t} = useTranslation(['collection', 'common']);

  const byId = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories],
  );

  return (
    <View style={styles.root}>
      {/* A search pill sits where the title was; tapping it opens search
          (the field, the category pills and the results). */}
      {searching ? (
        search
      ) : (
        <View style={styles.titleRow}>
          <Pressable
            onPress={onStartSearch}
            accessibilityRole="search"
            accessibilityLabel={t('collectionScreen.search.placeholder')}
            style={({pressed}) => [
              styles.searchPill,
              pressed && styles.pressed,
            ]}>
            <Feather
              name="search"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>
              {t('collectionScreen.search.placeholder')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onAdd}
            hitSlop={6}
            style={({pressed}) => [styles.addButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('collectionScreen.addToCollection')}>
            <Feather
              name="plus"
              size={moderateScale(19)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      )}

      {searching ? results : null}

      {searching
        ? null
        : GROUPS.map(group => {
            const rows = group.ids
              .map(id => byId.get(id))
              .filter((c): c is CollectionHomeCategory => Boolean(c));
            if (rows.length === 0) return null;
            return (
              <View key={group.key} style={styles.section}>
                <Text style={styles.sectionLabel} accessibilityRole="header">
                  {t(`collectionScreen.groups.${group.key}`)}
                </Text>
                <View style={styles.card}>
                  {rows.map((category, index) => {
                    const isEmpty = category.count === 0;
                    const subtitle = isEmpty
                      ? category.emptyText
                      : (category.summary ??
                        t('collectionScreen.itemsCount', {
                          count: category.count,
                        }));
                    return (
                      <View key={category.id}>
                        {index > 0 ? <View style={styles.separator} /> : null}
                        <Pressable
                          onPress={() => router.push(category.route as never)}
                          accessibilityRole="button"
                          accessibilityLabel={`${category.label}, ${subtitle}`}
                          style={[styles.row]}>
                          <CollectionPreview
                            category={category.id as CollectionCategoryId}
                            data={
                              isEmpty ? null : (category.previewData ?? null)
                            }
                            size={moderateScale(38)}
                          />
                          <View style={styles.text}>
                            <Text style={styles.label} numberOfLines={1}>
                              {category.label}
                            </Text>
                            <Text style={styles.subtitle} numberOfLines={1}>
                              {subtitle}
                            </Text>
                          </View>
                          <Feather
                            name="chevron-right"
                            size={moderateScale(18)}
                            color={Color(theme.colors.text)
                              .alpha(0.35)
                              .string()}
                            style={flipX}
                          />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    root: {
      paddingHorizontal: '16@ms',
      gap: '18@ms',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10@ms',
    },
    searchPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@ms',
      height: '40@ms',
      borderRadius: '12@ms',
      paddingHorizontal: '12@ms',
      backgroundColor: Color(theme.colors.text).alpha(0.07).string(),
    },
    searchPlaceholder: {
      flex: 1,
      fontFamily: theme.fonts.regular,
      fontSize: '15@ms',
      color: theme.colors.textSecondary,
    },
    addButton: {
      width: '38@ms',
      height: '38@ms',
      borderRadius: '19@ms',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.07).string(),
    },
    pressed: {opacity: 0.6},
    // @ai-start: the Settings grouped-list look
    section: {gap: GROUPED_HEADER_GAP},
    sectionLabel: {
      ...groupedHeaderStyle(theme),
      marginStart: SETTINGS_ROW_INSET,
    },
    card: {
      borderRadius: GROUPED_CARD_RADIUS,
      overflow: 'hidden',
      backgroundColor: groupedCardColor(theme),
    },
    // @ai-end
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
      minHeight: '60@ms',
      paddingVertical: '9@ms',
      paddingHorizontal: SETTINGS_ROW_INSET, // @ai
    },
    text: {flex: 1, minWidth: 0},
    label: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '15@ms',
      color: theme.colors.text,
    },
    subtitle: {
      fontFamily: theme.fonts.regular,
      fontSize: '12@ms',
      color: theme.colors.textSecondary,
      marginTop: '1@ms',
    },
    separator: {
      height: StyleSheet.hairlineWidth, // @ai
      marginStart: '70@ms',
      marginEnd: SETTINGS_ROW_INSET, // @ai
      backgroundColor: groupedSeparatorColor(theme), // @ai
    },
  });
