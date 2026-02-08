/**
 * Collection Search Modal
 *
 * This modal allows users to search their entire collection:
 * - Playlists (by name AND by content inside playlists)
 * - Loved tracks (by surah name)
 * - Downloads (by surah name + reciter)
 * - Favorite reciters
 * - Rewayat (recitation styles)
 *
 * Uses "deep search" meaning it searches inside playlists, not just names.
 */

import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur';
import Color from 'color';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useLoved} from '@/hooks/useLoved';
import {useDownloads} from '@/services/player/store/downloadSelectors';
import {usePlaylists} from '@/hooks/usePlaylists';
import {SearchInput} from '@/components/SearchInput';
import {getSurahById, getAllReciters} from '@/services/dataService';
import {UserPlaylist, PlaylistItem} from '@/services/playlist/PlaylistService';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
/**
 * Simplified type for loved tracks from the useLoved hook
 * The hook returns a subset without the timestamp field
 */
type SimplifiedLovedTrack = {
  reciterId: string;
  surahId: string;
  rewayatId: string;
};
import {DownloadedSurah} from '@/services/player/store/downloadStore';

/**
 * SEARCH DEBOUNCE TIME
 * Prevents too many searches while user is typing
 * 300ms means we wait for user to stop typing for 300ms before searching
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Metadata can contain different types based on result type
 */
type SearchResultMetadata =
  | {kind: 'playlist'; data: UserPlaylist}
  | {
      kind: 'playlist_item';
      data: {playlist: UserPlaylist; item: PlaylistItem; surah: Surah};
    }
  | {kind: 'reciter'; data: Reciter}
  | {kind: 'rewayat'; data: {reciter: Reciter; rewayat: Rewayat}}
  | {kind: 'surah'; data: SimplifiedLovedTrack}
  | {kind: 'download'; data: DownloadedSurah};

/**
 * Interface for search results
 * Each result has a type and the actual data
 */
interface SearchResult {
  type:
    | 'playlist'
    | 'reciter'
    | 'surah'
    | 'rewayat'
    | 'download'
    | 'playlist_item';
  id: string;
  title: string;
  subtitle: string;
  metadata: SearchResultMetadata;
}

interface CollectionSearchModalProps {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
}

export const CollectionSearchModal: React.FC<CollectionSearchModalProps> = ({
  visible,
  onClose,
  theme: _theme,
}) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * Search query - what the user is typing
   */
  const [query, setQuery] = useState('');

  /**
   * Search results - what we find
   */
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  /**
   * Are we currently searching? (for loading indicator)
   */
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Reference to the search input so we can focus it when modal opens
   */
  const searchInputRef = useRef<TextInput>(null);

  // ============================================
  // HOOKS - Getting Data
  // ============================================

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {theme: activeTheme} = useTheme();

  // Get all user's collection data
  const {favoriteReciters} = useFavoriteReciters(); // User's favorite reciters
  const {lovedTracks} = useLoved(); // Surahs they loved
  const downloads = useDownloads(); // Downloaded surahs
  const {playlists, getPlaylistItems} = usePlaylists(); // Playlists + function to get items

  // Get ALL reciters (not just favorites) for lookup
  const [allReciters, setAllReciters] = useState<Reciter[]>([]);

  // Load all reciters on mount
  useEffect(() => {
    getAllReciters().then(setAllReciters);
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Effect: Auto-focus search when modal opens
   * When the modal becomes visible, automatically put cursor in search box
   */
  useEffect(() => {
    if (visible) {
      // Wait 100ms for animation to start, then focus
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // When closing, reset everything
      setQuery('');
      setSearchResults([]);
    }
  }, [visible]);

  // ============================================
  // DEEP SEARCH FUNCTION
  // ============================================

  /**
   * This is where the magic happens!
   * Performs deep search across all collection types
   *
   * @param searchQuery - What the user is searching for
   */
  const performSearch = async (searchQuery: string) => {
    // Normalize the query (lowercase, trim whitespace)
    const normalizedQuery = searchQuery.toLowerCase().trim();

    // If no query, show nothing
    if (normalizedQuery.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    console.log('🔍 Starting deep search for:', normalizedQuery);
    console.log('📊 Collection data:', {
      playlists: playlists?.length || 0,
      lovedTracks: lovedTracks?.length || 0,
      downloads: downloads?.length || 0,
      favoriteReciters: favoriteReciters?.length || 0,
    });
    setIsSearching(true);
    const results: SearchResult[] = [];

    // ============================================
    // 1. SEARCH PLAYLISTS - Deep Search!
    // ============================================
    console.log('📚 Searching playlists...');
    console.log(
      '  Playlists available:',
      playlists?.map(p => p.name),
    );

    if (!playlists || playlists.length === 0) {
      console.log('  ⚠️ No playlists available');
    }

    for (const playlist of playlists || []) {
      /**
       * STEP 1: Check if playlist NAME matches
       */
      if (playlist.name.toLowerCase().includes(normalizedQuery)) {
        results.push({
          type: 'playlist',
          id: playlist.id,
          title: playlist.name,
          subtitle: `${playlist.itemCount} items`,
          metadata: {kind: 'playlist', data: playlist},
        });
        console.log('  ✓ Found playlist by name:', playlist.name);
      }

      /**
       * STEP 2: Deep search - check items INSIDE the playlist
       * Only do this if name didn't match (avoid unnecessary DB calls)
       */
      const nameMatched = playlist.name.toLowerCase().includes(normalizedQuery);

      if (!nameMatched && playlist.itemCount > 0) {
        try {
          // Fetch the items inside this playlist (async database call)
          const items = await getPlaylistItems(playlist.id);
          console.log(
            `  📦 Checking ${items.length} items inside "${playlist.name}"`,
          );

          // For each item, check if it matches the query
          for (const item of items) {
            // Get surah information
            const surah = getSurahById(parseInt(item.surahId, 10));

            if (surah) {
              // Check if surah name matches
              const surahNameMatch = surah.name
                .toLowerCase()
                .includes(normalizedQuery);
              const surahArabicMatch = surah.name_arabic.includes(searchQuery); // Arabic doesn't have case, so use original query
              const surahTransMatch = surah.translated_name_english
                .toLowerCase()
                .includes(normalizedQuery);

              if (surahNameMatch || surahArabicMatch || surahTransMatch) {
                // Get reciter name for context - search in ALL reciters, not just favorites
                const reciter =
                  allReciters.find(r => r.id === item.reciterId) ||
                  favoriteReciters.find(r => r.id === item.reciterId);
                const reciterName = reciter ? reciter.name : 'Unknown Reciter';

                results.push({
                  type: 'playlist_item',
                  id: `playlist-${playlist.id}-item-${item.id}`,
                  title: surah.name,
                  subtitle: `${reciterName} • in "${playlist.name}" playlist`,
                  metadata: {
                    kind: 'playlist_item',
                    data: {
                      playlist,
                      item,
                      surah,
                    },
                  },
                });
                console.log(
                  `  ✓ Found surah "${surah.name}" in playlist "${playlist.name}"`,
                );
              }
            }
          }
        } catch (error: unknown) {
          console.error(`  ❌ Error searching playlist ${playlist.id}:`, error);
        }
      }
    }

    // ============================================
    // 2. SEARCH LOVED TRACKS
    // ============================================
    console.log('❤️ Searching loved tracks...', lovedTracks?.length || 0);

    if (!lovedTracks || lovedTracks.length === 0) {
      console.log('  ⚠️ No loved tracks available');
    }

    lovedTracks.forEach(track => {
      // Get reciter info - search in ALL reciters, not just favorites
      const reciter =
        allReciters.find(r => r.id === track.reciterId) ||
        favoriteReciters.find(r => r.id === track.reciterId);
      if (!reciter) return;

      // Get surah info
      const surah = getSurahById(parseInt(track.surahId, 10));
      if (!surah) return;

      // Check if reciter name, surah name, or arabic name matches
      const matches =
        reciter.name.toLowerCase().includes(normalizedQuery) ||
        surah.name.toLowerCase().includes(normalizedQuery) ||
        surah.name_arabic.includes(searchQuery) ||
        surah.translated_name_english.toLowerCase().includes(normalizedQuery);

      if (matches) {
        results.push({
          type: 'surah',
          id: `loved-${track.reciterId}-${track.surahId}-${track.rewayatId}`,
          title: surah.name,
          subtitle: `Loved • ${reciter.name}`,
          metadata: {kind: 'surah', data: track},
        });
        console.log('  ✓ Found loved track:', surah.name);
      }
    });

    // ============================================
    // 3. SEARCH DOWNLOADS
    // ============================================
    console.log('💾 Searching downloads...', downloads?.length || 0);

    if (!downloads || downloads.length === 0) {
      console.log('  ⚠️ No downloads available');
    }

    downloads.forEach(download => {
      // Get reciter info - search in ALL reciters, not just favorites
      const reciter =
        allReciters.find(r => r.id === download.reciterId) ||
        favoriteReciters.find(r => r.id === download.reciterId);
      if (!reciter) return;

      // Get surah info
      const surah = getSurahById(parseInt(download.surahId, 10));
      if (!surah) return;

      // Check if matches
      const matches =
        reciter.name.toLowerCase().includes(normalizedQuery) ||
        surah.name.toLowerCase().includes(normalizedQuery) ||
        surah.name_arabic.includes(searchQuery) ||
        surah.translated_name_english.toLowerCase().includes(normalizedQuery);

      if (matches) {
        results.push({
          type: 'download',
          id: `download-${download.reciterId}-${download.surahId}-${download.rewayatId}`,
          title: `Downloaded: ${surah.name}`,
          subtitle: reciter.name,
          metadata: {kind: 'download', data: download},
        });
        console.log('  ✓ Found download:', surah.name);
      }
    });

    // ============================================
    // 4. SEARCH FAVORITE RECITERS
    // ============================================
    console.log(
      '⭐ Searching favorite reciters...',
      favoriteReciters?.length || 0,
    );

    if (!favoriteReciters || favoriteReciters.length === 0) {
      console.log('  ⚠️ No favorite reciters available');
    }

    favoriteReciters.forEach(reciter => {
      // Check if reciter name matches
      if (reciter.name.toLowerCase().includes(normalizedQuery)) {
        results.push({
          type: 'reciter',
          id: reciter.id,
          title: reciter.name,
          subtitle: `${reciter.rewayat.length} rewayat available`,
          metadata: {kind: 'reciter', data: reciter},
        });
        console.log('  ✓ Found favorite reciter:', reciter.name);
      }

      /**
       * Also search their rewayat (recitation styles)
       */
      reciter.rewayat.forEach(rewayat => {
        // Search in rewayat name, style, and compare lowercase for case-insensitive matching
        const rewayatMatches =
          rewayat.name.toLowerCase().includes(normalizedQuery) ||
          rewayat.style.toLowerCase().includes(normalizedQuery);

        if (rewayatMatches) {
          results.push({
            type: 'rewayat',
            id: rewayat.id,
            title: `${rewayat.name} by ${reciter.name}`,
            subtitle: 'Rewayat',
            metadata: {kind: 'rewayat', data: {reciter, rewayat}},
          });
          console.log('  ✓ Found rewayat:', rewayat.name);
        }
      });
    });

    console.log(`✅ Search complete! Found ${results.length} results`);

    // Update UI with results
    setSearchResults(results);
    setIsSearching(false);
  };

  // ============================================
  // DEBOUNCED SEARCH
  // ============================================

  /**
   * Debounce the search query
   * This prevents searching on every keystroke
   * Waits for user to stop typing for 300ms
   */
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      await performSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    // Cleanup timeout on unmount or query change
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // Only depend on query, and always use latest values from props/hooks
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // NAVIGATION HANDLER
  // ============================================

  /**
   * Handle when user taps on a search result
   * Navigates to the appropriate screen based on result type
   */
  const handleResultPress = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss(); // Hide keyboard

      switch (result.type) {
        case 'playlist':
          // Navigate to playlist detail page
          router.push(`/playlist/${result.id}`);
          break;

        case 'playlist_item':
          // Navigate to the track inside the playlist
          if (result.metadata.kind === 'playlist_item') {
            const {item} = result.metadata.data;
            router.push({
              pathname: '/player',
              params: {
                reciterId: item.reciterId,
                surahId: item.surahId,
                rewayatId: item.rewayatId,
              },
            });
          }
          break;

        case 'reciter':
          // Navigate to reciter profile
          router.push(`/reciter/${result.id}`);
          break;

        case 'rewayat':
          // Navigate to reciter profile (they can select the rewayat there)
          if (result.metadata.kind === 'rewayat') {
            const {reciter} = result.metadata.data;
            router.push(`/reciter/${reciter.id}`);
          }
          break;

        case 'surah':
        case 'download':
          // Navigate to player with the track
          if (
            result.metadata.kind === 'surah' ||
            result.metadata.kind === 'download'
          ) {
            const track = result.metadata.data;
            router.push({
              pathname: '/player',
              params: {
                reciterId: track.reciterId,
                surahId: track.surahId,
                rewayatId: track.rewayatId,
              },
            });
          }
          break;
      }

      // Close modal
      onClose();
    },
    [router, onClose],
  );

  // ============================================
  // UI HELPERS
  // ============================================

  /**
   * Get icon for each result type
   */
  const getIconForType = (type: string) => {
    switch (type) {
      case 'playlist':
        return 'book-open';
      case 'reciter':
        return 'user';
      case 'surah':
        return 'heart';
      case 'rewayat':
        return 'music';
      case 'download':
        return 'download';
      case 'playlist_item':
        return 'file-text';
      default:
        return 'search';
    }
  };

  /**
   * Get type label for each result
   */
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'playlist':
        return 'Playlist';
      case 'reciter':
        return 'Reciter';
      case 'surah':
        return 'Loved';
      case 'rewayat':
        return 'Rewayat';
      case 'download':
        return 'Downloaded';
      case 'playlist_item':
        return 'In Playlist';
      default:
        return '';
    }
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  /**
   * Render each search result item
   */
  const renderSearchResult = ({item}: {item: SearchResult}) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
      activeOpacity={0.7}>
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          {backgroundColor: activeTheme.colors.card},
        ]}>
        <Feather
          name={getIconForType(item.type) as any}
          size={moderateScale(20)}
          color={activeTheme.colors.text}
        />
      </View>

      {/* Text Content */}
      <View style={styles.resultContent}>
        <Text
          style={[styles.resultTitle, {color: activeTheme.colors.text}]}
          numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={[
            styles.resultSubtitle,
            {color: activeTheme.colors.textSecondary},
          ]}
          numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>

      {/* Type Badge */}
      <View style={styles.typeBadge}>
        <Text
          style={[
            styles.typeBadgeText,
            {color: activeTheme.colors.textSecondary},
          ]}>
          {getTypeLabel(item.type)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Don't render if not visible
  if (!visible) return null;

  // ============================================
  // MAIN UI
  // ============================================

  return (
    <View
      style={[
        styles.modalContainer,
        {backgroundColor: activeTheme.colors.background},
      ]}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.container}>
        {/* Header with Search Input */}
        <View style={[styles.headerContainer, {paddingTop: insets.top}]}>
          {/* Blur effect for iOS */}
          {Platform.OS === 'ios' ? (
            <BlurView
              blurAmount={80}
              blurType={activeTheme.isDarkMode ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: Color(activeTheme.colors.card)
                      .alpha(0.7)
                      .toString(),
                  },
                ]}
              />
            </BlurView>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {backgroundColor: activeTheme.colors.card, opacity: 0.95},
              ]}
            />
          )}

          {/* Search Input */}
          <View style={styles.headerContent}>
            <SearchInput
              ref={searchInputRef}
              placeholder="Search playlists, reciters, surahs, rewayat..."
              value={query}
              onChangeText={setQuery}
              onCancel={() => {
                Keyboard.dismiss();
                onClose();
              }}
              iconColor={activeTheme.colors.text}
              textColor={activeTheme.colors.text}
              backgroundColor={Color(activeTheme.colors.card)
                .alpha(0.5)
                .toString()}
              borderColor={Color(activeTheme.colors.border)
                .alpha(0.2)
                .toString()}
              keyboardAppearance={activeTheme.isDarkMode ? 'dark' : 'light'}
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Results List */}
        {query.trim().length === 0 ? (
          /* Empty State - No search yet */
          <View style={styles.emptyState}>
            <Feather
              name="search"
              size={moderateScale(48)}
              color={activeTheme.colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, {color: activeTheme.colors.text}]}>
              Search Your Collection
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                {color: activeTheme.colors.textSecondary},
              ]}>
              Search playlists, reciters, surahs, rewayat, and downloads
            </Text>
          </View>
        ) : (
          /* Search Results */
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
            contentContainerStyle={styles.resultsContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            /* Header - Shows loading or empty state */
            ListHeaderComponent={
              isSearching ? (
                <View style={styles.loadingContainer}>
                  <Feather
                    name="loader"
                    size={moderateScale(24)}
                    color={activeTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.loadingText,
                      {color: activeTheme.colors.textSecondary},
                    ]}>
                    Searching...
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Feather
                    name="inbox"
                    size={moderateScale(48)}
                    color={activeTheme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.noResultsText,
                      {color: activeTheme.colors.text},
                    ]}>
                    No results found
                  </Text>
                  <Text
                    style={[
                      styles.noResultsSubtext,
                      {color: activeTheme.colors.textSecondary},
                    ]}>
                    Try different keywords
                  </Text>
                </View>
              ) : (
                /* Show result count */
                <View style={styles.resultsHeader}>
                  <Text
                    style={[
                      styles.resultsCount,
                      {color: activeTheme.colors.textSecondary},
                    ]}>
                    {searchResults.length}{' '}
                    {searchResults.length === 1 ? 'result' : 'results'}
                  </Text>
                </View>
              )
            }
            /* Footer - Extra space at bottom */
            ListFooterComponent={<View style={{height: moderateScale(100)}} />}
          />
        )}
      </Animated.View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'relative',
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(8),
  },
  resultsContainer: {
    paddingTop: moderateScale(8),
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  iconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  resultContent: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  resultTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginBottom: moderateScale(2),
  },
  resultSubtitle: {
    fontSize: moderateScale(12),
  },
  typeBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(4),
  },
  typeBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    marginTop: moderateScale(16),
    marginBottom: moderateScale(8),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(24),
    gap: moderateScale(8),
  },
  loadingText: {
    fontSize: moderateScale(14),
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(48),
    paddingHorizontal: moderateScale(32),
  },
  noResultsText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginTop: moderateScale(16),
    marginBottom: moderateScale(8),
  },
  noResultsSubtext: {
    fontSize: moderateScale(14),
  },
  resultsHeader: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  resultsCount: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
});
