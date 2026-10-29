// @ai-generated
import React, {useCallback, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useBottomInset} from '@/hooks/useBottomInset';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import type {UserPlaylist} from '@/services/database/DatabaseService';
import {computeGridLayout, computeShelfLayout} from '@/utils/gridLayout';

/** A Library category, as the Collection screen lists it. */
export interface CollectionCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  emptyText: string;
  route: string;
}

/** Category tiles are wider than cards so labels and counts fit (listening/04). */
const MIN_TILE_WIDTH = 200;
const MIN_PLAYLIST_WIDTH = 150;

/** Page margin and gutter for the window's width class (ipad-standards §5.2). */
export function collectionSpacing(windowWidth: number): {
  margin: number;
  gap: number;
} {
  if (windowWidth >= 1280) return {margin: 40, gap: 24};
  if (windowWidth >= 900) return {margin: 32, gap: 20};
  return {margin: 24, gap: 16};
}

interface TabletCollectionHomeProps {
  categories: CollectionCategory[];
  playlists: UserPlaylist[];
  onAdd: () => void;
}

/**
 * The Collection tab on iPad (listening/04, "Library home", medium): a
 * title with an add button, the categories as tinted tiles in a grid sized
 * from the pane, and a shelf of the user's playlists.
 */
export function TabletCollectionHome({
  categories,
  playlists,
  onAdd,
}: TabletCollectionHomeProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['collection', 'common']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const {width: windowWidth} = useWindowDimensions();
  const [paneWidth, setPaneWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setPaneWidth(e.nativeEvent.layout.width);
  }, []);

  const {margin, gap} = collectionSpacing(windowWidth);
  const grid = computeGridLayout(paneWidth, {
    minCardWidth: MIN_TILE_WIDTH,
    horizontalPadding: margin,
    gap,
    minColumns: 2,
  });
  const shelf = computeShelfLayout(paneWidth, {
    minCardWidth: MIN_PLAYLIST_WIDTH,
    leadingPadding: margin,
    gap,
    peek: 0.3,
    minColumns: 2,
  });
  const text = theme.colors.text;
  const secondary = theme.colors.textSecondary;

  return (
    <View
      style={[styles.fill, {backgroundColor: theme.colors.background}]}
      onLayout={handleLayout}>
      <ScrollView
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={{
          paddingTop: USE_GLASS ? 16 : insets.top + 16,
          paddingBottom: bottomInset + 32,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.titleRow, {paddingHorizontal: margin}]}>
          <Text
            style={[styles.title, {color: text}]}
            accessibilityRole="header">
            {t('common:tabs.collection')}
          </Text>
          <Pressable
            onPress={onAdd}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('collectionScreen.addToCollection')}
            style={({pressed}) => [
              styles.addButton,
              {
                backgroundColor: Color(text)
                  .alpha(pressed ? 0.12 : 0.06)
                  .toString(),
              },
            ]}>
            <Feather name="plus" size={22} color={text} />
          </Pressable>
        </View>

        {paneWidth > 0 ? (
          <View style={[styles.grid, {paddingHorizontal: margin, gap}]}>
            {categories.map(category => {
              const subtitle =
                category.count > 0
                  ? t('collectionScreen.itemsCount', {count: category.count})
                  : category.emptyText;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => router.push(category.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${category.label}, ${subtitle}`}
                  style={({pressed}) => [
                    styles.tile,
                    {
                      width: grid.itemWidth,
                      backgroundColor: Color(category.color)
                        .alpha(pressed ? 0.18 : 0.12)
                        .toString(),
                    },
                  ]}>
                  <View
                    style={[
                      styles.tileIcon,
                      {
                        backgroundColor: Color(category.color)
                          .alpha(0.16)
                          .toString(),
                      },
                    ]}>
                    {category.icon}
                  </View>
                  <View style={styles.tileText}>
                    <Text
                      style={[styles.tileLabel, {color: text}]}
                      numberOfLines={1}>
                      {category.label}
                    </Text>
                    {/* Two lines: an empty tile's hint ("No loved surahs
                        yet") is wider than a 4-column tile on the 13". */}
                    <Text
                      style={[styles.tileCount, {color: secondary}]}
                      numberOfLines={2}>
                      {subtitle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {paneWidth > 0 && playlists.length > 0 ? (
          <View style={styles.shelfSection}>
            <View style={[styles.shelfHeader, {paddingHorizontal: margin}]}>
              <Text
                style={[styles.shelfTitle, {color: text}]}
                accessibilityRole="header">
                {t('common:terms.playlists')}
              </Text>
              <Pressable
                onPress={() => router.push('/collection/playlists' as never)}
                hitSlop={8}
                accessibilityRole="button"
                style={({pressed}) => pressed && styles.pressed}>
                <Text style={[styles.seeAll, {color: secondary}]}>
                  {t('common:actions.seeAll')}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal: margin, gap}}>
              {playlists.map(playlist => (
                <PlaylistCard
                  key={playlist.id}
                  name={playlist.name}
                  itemCount={playlist.itemCount}
                  color={playlist.color}
                  width={shelf.itemWidth}
                  height={shelf.itemWidth}
                  onPress={() => router.push(`/playlist/${playlist.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Manrope-Bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    minHeight: 88,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tileLabel: {
    fontSize: 17,
    fontFamily: 'Manrope-SemiBold',
    textAlign: 'left',
  },
  tileCount: {
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
    textAlign: 'left',
  },
  shelfSection: {
    marginTop: 32,
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  shelfTitle: {
    fontSize: 22,
    fontFamily: 'Manrope-Bold',
  },
  seeAll: {
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  pressed: {
    opacity: 0.6,
  },
});
