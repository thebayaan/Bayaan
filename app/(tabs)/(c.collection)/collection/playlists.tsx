import React, {useRef, useCallback, useMemo, useState} from 'react'; // @ai
import {
  View,
  Pressable,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PlaylistItem} from '@/components/PlaylistItem';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {BackIcon} from '@/components/ActionIcons'; // @ai
import {moderateScale} from '@/utils/scale';
import {usePlaylists} from '@/hooks/usePlaylists';
import {PlaylistIcon} from '@/components/Icons';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import {showCreatePlaylistSheet} from '@/components/collection/showCreatePlaylistSheet'; // @ai
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-start
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  PlaylistOptionsMenu,
  type PlaylistOptionsPayload,
} from '@/components/sheets/options/playlistOptions';
// @ai-end
import Color from 'color';
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import {
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PanelRow,
} from '@/components/collection/CollectionPanel'; // @ai
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
import {
  CollectionHeaderActions,
  CollectionScreenHeader,
  CollectionSearchField,
} from '@/components/collection/CollectionScreenHeader';
import {SurahMosaic} from '@/components/collection/CollectionArt';
import {
  CollectionGridTile,
  GRID_GAP,
  GRID_PADDING,
  useGridTileWidth,
} from '@/components/collection/CollectionGridTile';
import {usePlaylistCovers} from '@/hooks/useCollectionPreviews';
import {useCollectionViewPref} from '@/store/collectionViewStore';
import {matchesQuery} from '@/utils/collectionSearch';
// @ai-end

// @ai-start
export default function PlaylistsScreen() {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const nativeMenus = useNativeOptionsMenu(); // @ai
  const {playlists, createPlaylist, deletePlaylist, updatePlaylist} =
    usePlaylists();

  const scrollY = useRef(new RNAnimated.Value(0)).current;

  // @ai-start
  const {view, sort} = useCollectionViewPref('playlists');
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [searching, setSearching] = useState(Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const covers = usePlaylistCovers(playlists);
  const tileWidth = useGridTileWidth(3);
  const sortedPlaylists = useMemo(() => {
    const list = [...playlists];
    if (sort === 'title') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'created') list.sort((a, b) => b.createdAt - a.createdAt);
    else list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [playlists, sort]);
  const visiblePlaylists = useMemo(
    () =>
      searching && query.trim()
        ? sortedPlaylists.filter(p =>
            matchesQuery(query, [p.name, p.description]),
          )
        : sortedPlaylists,
    [sortedPlaylists, searching, query],
  );
  const totalItems = playlists.reduce((sum, p) => sum + p.itemCount, 0);
  const renderHeaderRight = useCallback(
    () =>
      searching ? null : (
        <CollectionHeaderActions
          screen="playlists"
          onSearch={() => setSearching(true)}
        />
      ),
    [searching],
  );

  useCollectionNativeHeader({
    title: t('common:terms.playlists'),
    scrollY,
    hasContent: playlists.length > 0,
    headerRight: playlists.length > 0 ? renderHeaderRight : undefined,
  });
  // @ai-end

  const existingColors = useMemo(
    () => playlists.map(p => p.color),
    [playlists],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        headerContainer: {
          width: '100%',
          overflow: 'hidden',
        },
        contentArea: {
          width: '100%',
          alignItems: 'center',
          paddingTop: USE_GLASS
            ? moderateScale(16)
            : insets.top + moderateScale(40),
          paddingBottom: moderateScale(30),
          overflow: 'hidden',
          backgroundColor: theme.colors.background,
        },
        contentCenter: {
          alignItems: 'center',
          paddingHorizontal: moderateScale(20),
        },
        heroIconContainer: {
          width: moderateScale(64),
          height: moderateScale(64),
          borderRadius: moderateScale(32),
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: moderateScale(12),
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.1)
            .toString(),
        },
        heroIconInner: {
          width: moderateScale(56),
          height: moderateScale(56),
          borderRadius: moderateScale(28),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Color(theme.colors.textSecondary)
            .alpha(0.08)
            .toString(),
        },
        title: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
          letterSpacing: latinLetterSpacing(-0.3),
        },
        subtitle: {
          fontSize: moderateScale(12),
          color: theme.colors.text,
          fontFamily: theme.fonts.regular,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        createBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          marginHorizontal: moderateScale(16),
          marginTop: moderateScale(8),
          marginBottom: moderateScale(8),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        createBarText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
        listContentContainer: {
          flexGrow: 1,
        },
        fixedBackButton: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          left: moderateScale(15),
          zIndex: 5,
          padding: moderateScale(8),
        },
        emptyHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: moderateScale(12),
          paddingHorizontal: moderateScale(16),
        },
        emptyHeaderBack: {
          width: moderateScale(36),
          height: moderateScale(36),
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyHeaderTitle: {
          flex: 1,
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
        },
        emptyContent: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: moderateScale(32),
          paddingBottom: moderateScale(60),
        },
        emptyIcon: {
          marginBottom: moderateScale(16),
        },
        emptyTitle: {
          fontSize: moderateScale(17),
          fontFamily: theme.fonts.bold,
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: moderateScale(8),
        },
        emptySubtitle: {
          fontSize: moderateScale(13),
          fontFamily: theme.fonts.regular,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginBottom: moderateScale(20),
        },
        emptyActionBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: moderateScale(12),
          paddingHorizontal: moderateScale(32),
          borderRadius: moderateScale(12),
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          gap: moderateScale(8),
        },
        emptyActionText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
      }),
    [theme, insets.top],
  );

  const handlePlaylistPress = useCallback(
    (playlistId: string) => {
      router.push(`/playlist/${playlistId}`);
    },
    [router],
  );

  // @ai-start
  const buildPlaylistOptions = useCallback(
    (item: (typeof playlists)[0]): PlaylistOptionsPayload => ({
      playlistId: item.id,
      playlistName: item.name,
      playlistColor: item.color,
      onDelete: async () => {
        await deletePlaylist(item.id);
      },
      onEdit: async () => {
        // @ai-start
        const result = await showCreatePlaylistSheet({
          existingColors,
          isEditMode: true,
          initialName: item.name,
          initialColor: item.color || '#6366F1',
        });
        // @ai-end
        if (result?.name && result?.color) {
          await updatePlaylist(item.id, {
            name: result.name,
            color: result.color,
          });
        }
      },
    }),
    [existingColors, updatePlaylist, deletePlaylist],
  );

  const handlePlaylistOptions = useCallback(
    (item: (typeof playlists)[0]) => {
      showSheet('playlist-context', {
        payload: buildPlaylistOptions(item),
      });
    },
    [buildPlaylistOptions],
  );
  // @ai-end

  const handleCreatePlaylist = useCallback(async () => {
    const result = await showCreatePlaylistSheet({existingColors}); // @ai
    if (result?.name && result?.color) {
      await createPlaylist(result.name, result.color);
    }
  }, [existingColors, createPlaylist]);

  const renderItem = useCallback(
    ({item, index}: {item: (typeof playlists)[0]; index: number}) =>
      // @ai-start
      view === 'grid' ? (
        <CollectionGridTile
          width={tileWidth}
          art={
            (covers[item.id]?.length ?? 0) > 0 ? (
              <SurahMosaic
                surahIds={covers[item.id]}
                size={tileWidth}
                radius={moderateScale(18)}
              />
            ) : (
              <View
                style={{
                  width: tileWidth,
                  height: tileWidth,
                  borderRadius: moderateScale(18),
                  backgroundColor: Color(item.color || '#6366F1')
                    .alpha(0.18)
                    .string(),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <PlaylistIcon
                  color={item.color || '#6366F1'}
                  size={tileWidth * 0.3}
                />
              </View>
            )
          }
          title={item.name}
          subtitle={t('common:counts.surahs', {count: item.itemCount})}
          onPress={() => handlePlaylistPress(item.id)}
          onLongPress={() => handlePlaylistOptions(item)}
        />
      ) : (
        // @ai-end
        <PanelRow
          first={index === 0}
          last={index === visiblePlaylists.length - 1}>
          <PlaylistItem
            id={item.id}
            name={item.name}
            itemCount={item.itemCount}
            color={item.color}
            countOnly
            art={
              (covers[item.id]?.length ?? 0) > 0 ? ( // @ai
                <SurahMosaic
                  surahIds={covers[item.id]}
                  size={PANEL_ART_SIZE}
                  radius={PANEL_ART_RADIUS}
                />
              ) : undefined
            }
            onPress={() => handlePlaylistPress(item.id)}
            onLongPress={() => handlePlaylistOptions(item)}
            onOptionsPress={() => handlePlaylistOptions(item)}
            optionsMenu={
              nativeMenus ? (
                <PlaylistOptionsMenu payload={buildPlaylistOptions(item)} />
              ) : undefined
            }
          />
        </PanelRow>
      ), // @ai
    [
      view, // @ai
      tileWidth, // @ai
      covers, // @ai
      t, // @ai
      handlePlaylistPress,
      handlePlaylistOptions,
      nativeMenus,
      buildPlaylistOptions,
      visiblePlaylists.length, // @ai
    ],
  );

  if (playlists.length === 0) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="playlists"
        title={t('common:terms.playlists')}
        meta={t('collectionScreen.emptyState.playlists.meta')}
        heading={t('collectionScreen.emptyState.playlists.heading')}
        message={t('collectionScreen.emptyState.playlists.message')}
        showBack={!isStackRoot}
        primary={{
          label: t('collectionScreen.emptyState.playlists.button'),
          icon: (
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.background}
            />
          ),
          onPress: handleCreatePlaylist,
        }}
      />
    );
  }

  // @ai-start
  const listHeader = searching ? (
    <CollectionSearchField
      value={query}
      onChangeText={setQuery}
      onCancel={() => {
        setSearching(false);
        setQuery('');
      }}
      placeholder={t('collectionScreen.search.placeholderIn', {
        name: t('common:terms.playlists'),
      })}
      resultLabel={
        query.trim()
          ? t('collectionScreen.search.matches', {
              count: visiblePlaylists.length,
            })
          : undefined
      }
      style={{
        paddingHorizontal: GRID_PADDING,
        paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
        paddingBottom: moderateScale(12),
      }}
    />
  ) : (
    <CollectionScreenHeader
      category="playlists"
      preview={null}
      title={t('common:terms.playlists')}
      meta={t('collectionScreen.meta.pair', {
        a: t('playlistsScreen.count', {count: playlists.length}),
        b: t('common:counts.surahs', {count: totalItems}),
      })}
      primary={{
        label: t('playlistsScreen.createNew'),
        icon: (
          <Feather
            name="plus"
            size={moderateScale(16)}
            color={theme.colors.background}
          />
        ),
        onPress: handleCreatePlaylist,
      }}
      actions={renderHeaderRight()}
    />
  );
  // @ai-end

  return (
    <View style={styles.container}>
      {/* Not at the stack root: nothing to go back to. @ai */}
      {!USE_GLASS && !isStackRoot && (
        <RNAnimated.View
          style={[
            styles.fixedBackButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [80, 120],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <BackIcon
              size={moderateScale(24)}
              color={theme.colors.text}
              style={flipX}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        key={view} // @ai a FlatList can't change its columns in place
        data={visiblePlaylists} // @ai
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={listHeader} // @ai
        numColumns={view === 'grid' ? 3 : 1} // @ai
        columnWrapperStyle={
          view === 'grid' // @ai
            ? {
                gap: GRID_GAP,
                paddingHorizontal: GRID_PADDING,
                marginBottom: moderateScale(18),
              }
            : undefined
        }
        keyboardShouldPersistTaps="handled" // @ai
        keyboardDismissMode="on-drag" // @ai
        contentContainerStyle={[
          styles.listContentContainer,
          {paddingBottom: listBottomPadding}, // @ai
        ]}
        onScroll={RNAnimated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
      {!USE_GLASS && (
        <CollectionStickyHeader
          title={t('common:terms.playlists')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
}
// @ai-end
