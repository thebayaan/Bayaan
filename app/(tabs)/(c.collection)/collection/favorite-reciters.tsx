import React, {useRef, useState, useCallback, useMemo} from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useLocalSearchParams} from 'expo-router'; // @ai
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ReciterItem} from '@/components/ReciterItem';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useRouter} from 'expo-router';
import {moderateScale} from '@/utils/scale';
import {Feather} from '@expo/vector-icons';
import {CollectionStickyHeader} from '@/components/collection/CollectionStickyHeader';
import Color from 'color';
import {Reciter} from '@/data/reciterData';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
import {useCollectionNativeHeader} from '@/hooks/useCollectionNativeHeader';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
// @ai-start
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {useTranslation} from 'react-i18next';
import {CollectionEmptyState} from '@/components/collection/CollectionEmptyState'; // @ai
import {PanelRow} from '@/components/collection/CollectionPanel'; // @ai
import {getReciterDisplayName} from '@/i18n/format';
import {useNativeOptionsMenu} from '@/components/sheets/options/OptionsMenu';
import {
  CollectionOptionsMenu,
  type CollectionOptionsPayload,
} from '@/components/sheets/options/collectionOptions';
import {rankReciters} from '@/utils/search/catalog'; // @ai
// @ai-start
import {
  CollectionHeaderActions,
  CollectionScreenHeader,
  CollectionSearchField,
} from '@/components/collection/CollectionScreenHeader';
import {GRID_PADDING} from '@/components/collection/CollectionGridTile';
import {useCollectionViewPref} from '@/store/collectionViewStore';
// @ai-end
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset'; // @ai
import {useIsStackRoot} from '@/components/tablet/useIsStackRoot'; // @ai
// @ai-end

// @ai-start
export default function FavoriteRecitersScreen() {
  const {theme} = useTheme();
  const listBottomPadding = useLibraryListBottomPadding(); // @ai
  const insets = useSafeAreaInsets();
  const {favoriteReciters, removeFavorite} = useFavoriteReciters();
  const router = useRouter();
  // The iPad sidebar opens this as the first screen of the Collection stack.
  // Back then has nothing to pop and used to switch to the Home tab, so the
  // arrow is left out there, as the system header does on iPadOS 26. @ai
  const isStackRoot = useIsStackRoot(); // @ai
  const {t} = useTranslation(['collection', 'common']);
  const nativeMenus = useNativeOptionsMenu(); // @ai

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  // @ai A search typed on the Collection tab arrives as `q`.
  const {q: initialQuery} = useLocalSearchParams<{q?: string}>(); // @ai
  const [showSearch, setShowSearch] = useState(Boolean(initialQuery));
  const [searchQuery, setSearchQuery] = useState(initialQuery ?? '');

  // @ai-start
  const {sort} = useCollectionViewPref('reciters');
  const renderHeaderRight = useCallback(
    () =>
      showSearch ? null : (
        <CollectionHeaderActions
          screen="reciters"
          onSearch={() => setShowSearch(true)}
        />
      ),
    [showSearch],
  );
  // @ai-end

  useCollectionNativeHeader({
    title: t('favoriteRecitersScreen.title'),
    scrollY,
    hasContent: favoriteReciters.length > 0,
    headerRight: favoriteReciters.length > 0 ? renderHeaderRight : undefined,
  });

  // @ai-start
  // A query ranks by match; otherwise the order picked in the sort menu.
  const filteredReciters = useMemo(() => {
    if (searchQuery.trim()) {
      return [...rankReciters(searchQuery, favoriteReciters)];
    }
    const list = [...favoriteReciters];
    if (sort === 'name') {
      list.sort((a, b) =>
        getReciterDisplayName(a).localeCompare(getReciterDisplayName(b)),
      );
    } else {
      list.sort((a, b) => b.favoritedAt - a.favoritedAt);
    }
    return list;
  }, [favoriteReciters, searchQuery, sort]);
  // @ai-end

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
        addBar: {
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
        addBarText: {
          fontSize: moderateScale(13),
          fontFamily: 'Manrope-SemiBold',
          color: theme.colors.textSecondary,
        },
        searchBarContainer: {
          paddingHorizontal: moderateScale(16),
          marginBottom: moderateScale(12),
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
        fixedSearchToggle: {
          position: 'absolute',
          top: insets.top + moderateScale(10),
          right: moderateScale(15),
          // @ai: above CollectionStickyHeader (zIndex 10), whose transparent
          // overlay otherwise swallows taps on Android.
          zIndex: 11,
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

  const handleReciterPress = useCallback(
    (reciterId: string) => {
      router.push(`/reciter/${reciterId}`);
    },
    [router],
  );

  const handleOpenSelectReciters = useCallback(() => {
    showSheet('favorite-reciters');
  }, []);

  // @ai-start
  const buildReciterOptions = useCallback(
    (reciter: Reciter): CollectionOptionsPayload => ({
      title: getReciterDisplayName(reciter),
      subtitle: getDisplayLabelFromName(reciter.rewayat[0]?.name),
      options: [
        {
          label: t('favoriteRecitersScreen.removeFromFavorites'),
          icon: 'user-minus',
          destructive: true,
          onPress: () => removeFavorite(reciter.id),
        },
      ],
    }),
    [removeFavorite, t],
  );

  const handleReciterOptions = useCallback(
    (reciter: Reciter) => {
      showSheet('collection-options', {
        payload: buildReciterOptions(reciter),
      });
    },
    [buildReciterOptions],
  );
  // @ai-end

  const renderItem = useCallback(
    ({item, index}: {item: Reciter; index: number}) => (
      <PanelRow
        first={index === 0}
        last={index === filteredReciters.length - 1}>
        <ReciterItem
          inPanel
          item={item}
          onPress={reciter => handleReciterPress(reciter.id)}
          onOptionsPress={handleReciterOptions}
          onLongPress={handleReciterOptions}
          optionsMenu={
            nativeMenus ? (
              <CollectionOptionsMenu
                payload={buildReciterOptions(item)}
                layout="overlay"
              />
            ) : undefined
          }
        />
      </PanelRow>
    ),
    [
      filteredReciters.length, // @ai
      handleReciterPress,
      handleReciterOptions,
      nativeMenus,
      buildReciterOptions,
    ],
  );

  if (favoriteReciters.length === 0) {
    // @ai The empty screen keeps the full screen's frame.
    return (
      <CollectionEmptyState
        category="reciters"
        title={t('favoriteRecitersScreen.title')}
        meta={t('collectionScreen.emptyState.reciters.meta')}
        heading={t('collectionScreen.emptyState.reciters.heading')}
        message={t('collectionScreen.emptyState.reciters.message')}
        showBack={!isStackRoot}
        primary={{
          label: t('favoriteRecitersScreen.addReciters'),
          icon: (
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.background}
            />
          ),
          onPress: handleOpenSelectReciters,
        }}
      />
    );
  }

  // @ai: render as an element; a component defined here remounts the search
  // input on every keystroke and drops focus.
  const renderListHeader = (): React.ReactElement => {
    // @ai-start
    if (showSearch) {
      return (
        <CollectionSearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          onCancel={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          placeholder={t('favoriteRecitersScreen.searchPlaceholder')}
          resultLabel={
            searchQuery.trim()
              ? t('collectionScreen.search.matches', {
                  count: filteredReciters.length,
                })
              : undefined
          }
          style={{
            paddingHorizontal: GRID_PADDING,
            paddingTop: USE_GLASS ? moderateScale(8) : insets.top + 8,
            paddingBottom: moderateScale(12),
          }}
        />
      );
    }
    return (
      <CollectionScreenHeader
        category="reciters"
        preview={null}
        title={t('favoriteRecitersScreen.title')}
        meta={t('common:counts.reciters', {count: favoriteReciters.length})}
        primary={{
          label: t('favoriteRecitersScreen.addReciters'),
          icon: (
            <Feather
              name="plus"
              size={moderateScale(16)}
              color={theme.colors.background}
            />
          ),
          onPress: handleOpenSelectReciters,
        }}
        actions={renderHeaderRight()}
      />
    );
    // @ai-end
  };

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
            <Feather
              name="arrow-left"
              size={moderateScale(24)}
              color={theme.colors.text}
              style={flipX}
            />
          </Pressable>
        </RNAnimated.View>
      )}

      <RNAnimated.FlatList
        data={filteredReciters}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderListHeader()} // @ai
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
          title={t('favoriteRecitersScreen.title')}
          scrollY={scrollY}
        />
      )}
    </View>
  );
}
// @ai-end
