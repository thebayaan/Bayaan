// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {flipX} from '@/utils/rtl';
import type {CollectionCategory} from '@/components/collection/TabletCollectionHome';

/** A category row on the phone Collection tab: the shared category plus a
 *  live summary of what's inside and an optional small preview. */
export interface CollectionHomeCategory extends CollectionCategory {
  summary?: string;
  preview?: React.ReactNode;
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
}

/**
 * The Collection tab on phones: a large title with an add button, then the
 * categories grouped under grey labels (Listening, Reading, Yours), each
 * group in one rounded card. Each row keeps today's tinted icon and says
 * what's inside instead of only how many items there are.
 */
export function CollectionHomeList({
  categories,
  onAdd,
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
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('common:tabs.collection')}
        </Text>
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

      {GROUPS.map(group => {
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
                    t('collectionScreen.itemsCount', {count: category.count}));
                return (
                  <View key={category.id}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <Pressable
                      onPress={() => router.push(category.route as never)}
                      accessibilityRole="button"
                      accessibilityLabel={`${category.label}, ${subtitle}`}
                      style={({pressed}) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}>
                      <View
                        style={[
                          styles.icon,
                          {
                            backgroundColor: Color(category.color)
                              .alpha(0.15)
                              .string(),
                          },
                        ]}>
                        {category.icon}
                      </View>
                      <View style={styles.text}>
                        <Text style={styles.label} numberOfLines={1}>
                          {category.label}
                        </Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      </View>
                      {!isEmpty && category.preview ? (
                        <View style={styles.preview}>{category.preview}</View>
                      ) : null}
                      <Feather
                        name="chevron-right"
                        size={moderateScale(17)}
                        color={theme.colors.textSecondary}
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
      justifyContent: 'space-between',
      paddingStart: '4@ms',
    },
    title: {
      fontFamily: theme.fonts.extraBold,
      fontSize: '30@ms',
      letterSpacing: -0.5,
      color: theme.colors.text,
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
    section: {gap: '8@ms'},
    sectionLabel: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '13@ms',
      color: theme.colors.textSecondary,
      marginStart: '16@ms',
    },
    card: {
      borderRadius: '20@ms',
      overflow: 'hidden',
      backgroundColor: Color(theme.colors.text)
        .alpha(theme.isDarkMode ? 0.07 : 0.045)
        .string(),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
      minHeight: '60@ms',
      paddingVertical: '9@ms',
      paddingHorizontal: '14@ms',
    },
    rowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).string(),
    },
    icon: {
      width: '38@ms',
      height: '38@ms',
      borderRadius: '10@ms',
      alignItems: 'center',
      justifyContent: 'center',
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
    preview: {flexDirection: 'row', alignItems: 'center'},
    separator: {
      height: 1,
      marginStart: '64@ms',
      backgroundColor: Color(theme.colors.text).alpha(0.08).string(),
    },
  });
