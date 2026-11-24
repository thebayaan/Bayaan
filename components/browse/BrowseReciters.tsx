// @ai-generated
/**
 * Browse › All reciters: a screen for choosing a reciter by ear. Home
 * suggests what to listen to and the Search tab finds anything by name;
 * here every reciter is listed A–Z (or as small cards), the common rewayat
 * filter in one tap, and tapping a photo plays a short preview in place.
 * Opened for a surah ("Choose a reciter"), it lists only the reciters who
 * have it, puts your own first, and a tap plays the surah.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {Feather, MaterialIcons} from '@expo/vector-icons';
import {SymbolView} from 'expo-symbols';
import Color from 'color';
import {useNavigation, useRouter} from 'expo-router';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {RECITERS, type Reciter, type Rewayat} from '@/data/reciterData';
import {resolveRewayatName} from '@/data/rewayat';
import {
  getQari,
  getQariLabel,
  getNarratorLabel,
  resolveRewayahFromName,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {getReciterDisplayName} from '@/i18n/format';
import {getLocalReciterImage} from '@/utils/reciterImageLookup';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {useSettings} from '@/hooks/useSettings';
import {useRecentlyPlayedStore} from '@/services/player/store/recentlyPlayedStore';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {getSurahById} from '@/services/dataService';
import {createTracksForReciter} from '@/utils/track';
import {pickRewayatId} from '@/utils/rewayatPreference';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useReciterProfilePathname} from '@/hooks/useTabReciterPath';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';
import branding from '@/config/branding';
import Header from '@/components/Header';
import {tintedHeaderRight} from '@/components/TintedHeader';
import {SearchIcon} from '@/components/ActionIcons';
import {NativeMenu} from '@/components/native/NativeMenu';
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {CollectionSearchField} from '@/components/collection/CollectionScreenHeader';
import {
  PANEL_MARGIN,
  PANEL_ROW_PADDING,
} from '@/components/collection/CollectionPanel';
import {
  GROUPED_HEADER_GAP,
  GROUPED_SECTION_GAP,
  groupedHeaderStyle,
} from '@/components/settings/SettingsList';
import {useCollectionViewPref} from '@/store/collectionViewStore';
import {
  previewKey,
  useReciterPreview,
} from '@/components/default-reciter/useReciterPreview';
import {
  CARD_GAP,
  ReciterCard,
  ReciterPanelRow,
  type ReciterItemProps,
} from './ReciterBrowseItems';
import {AlphabetRail} from './AlphabetRail';
import {
  CHIP_REWAYAT,
  LETTERS_FROM,
  buildBrowseItems,
  filterReciters,
  letterSections,
  reciterLine,
  rewayahChipLabel,
  rewayahCounts,
  rewayahIdsOf,
  type BrowseItem,
  type BrowseSection,
  type BrowseSort,
} from './reciterBrowseModel';

/** Previews stop after this long. */
const PREVIEW_SECONDS = 30;
/** Card width the column count aims for. */
const CARD_MIN_WIDTH = moderateScale(104);

interface BrowseRecitersProps {
  theme: Theme;
  onBack: () => void;
  surahId?: number;
  title?: string;
  /** Opens filtered to a rewayah (Home's "Explore by rewayah" cards). */
  initialTeacher?: string;
  initialStudent?: string;
  /**
   * RFC-012: tiles can open the list with only reciters that have a photo.
   * Applies only when `has-photo` is in `branding.searchFilters`.
   */
  initialHasPhoto?: boolean;
}

/** The rewayah a Home "Explore by rewayah" card names, by teacher/student. */
function rewayahFromPeople(
  teacher?: string,
  student?: string,
): RewayahId | null {
  if (!teacher) return null;
  for (const reciter of RECITERS) {
    for (const rewaya of reciter.rewayat) {
      const entry = rewaya.name ? resolveRewayatName(rewaya.name) : undefined;
      if (!entry || entry.teacher !== teacher) continue;
      if (student && entry.student !== student) continue;
      const id = resolveRewayahFromName(rewaya.name);
      if (id) return id;
    }
  }
  return null;
}

function recordingFor(
  reciter: Reciter,
  rewayah: RewayahId | null,
): Rewayat | undefined {
  if (!rewayah) return undefined;
  return reciter.rewayat.find(r => resolveRewayahFromName(r.name) === rewayah);
}

export default function BrowseReciters({
  theme,
  onBack,
  surahId,
  title,
  initialTeacher,
  initialStudent,
  initialHasPhoto = false,
}: BrowseRecitersProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const profilePathname = useReciterProfilePathname();
  const {t} = useTranslation(['home', 'common']);
  const {updateQueue} = usePlayerActions();
  const startNewChain = useRecentlyPlayedStore(s => s.startNewChain);
  const {setReciterPreference} = useSettings();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const {isTablet} = useResponsive();
  const {width: windowWidth} = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pickingRef = useRef(false);
  const listRef = useRef<FlashListRef<BrowseItem>>(null);
  const headerHeight = useHeaderHeight();

  // ── Filters, view and sort ────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [rewayah, setRewayah] = useState<RewayahId | null>(() =>
    rewayahFromPeople(initialTeacher, initialStudent),
  );
  const [completeOnly, setCompleteOnly] = useState(false);
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const hasPhotoOnly =
    initialHasPhoto && !!branding.searchFilters?.includes('has-photo');
  const {
    view: storedView,
    sort: storedSort,
    setView,
    setSort,
  } = useCollectionViewPref('browseReciters');
  const view = storedView === 'grid' ? 'cards' : 'list';
  const sort: BrowseSort = storedSort === 'recent' ? 'recent' : 'name';

  const stopSearching = useCallback(() => {
    setSearching(false);
    setQuery('');
    Keyboard.dismiss();
  }, []);

  const clearFilters = useCallback(() => {
    setRewayah(null);
    setCompleteOnly(false);
    setDownloadedOnly(false);
    setQuery('');
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────
  const {favoriteReciters, isFavoriteReciter, toggleFavorite} =
    useFavoriteReciters();
  const downloads = useDownloadStore(s => s.downloads);
  const downloadedIds = useMemo(
    () =>
      new Set(
        downloads.filter(d => d.status === 'completed').map(d => d.reciterId),
      ),
    [downloads],
  );

  // Reciters the screen can show at all (a surah narrows it).
  const pool = useMemo(() => {
    let list: Reciter[] = RECITERS;
    if (surahId) {
      list = list.filter(r =>
        r.rewayat.some(rewaya => rewaya.surah_list?.includes(surahId)),
      );
    }
    if (hasPhotoOnly) {
      list = list.filter(r => !!r.image_url || !!getLocalReciterImage(r.name));
    }
    return list;
  }, [surahId, hasPhotoOnly]);

  const reciters = useMemo(
    () =>
      filterReciters(
        pool,
        {
          query: searching ? query : '',
          rewayah,
          completeOnly,
          downloadedOnly,
          downloadedIds,
        },
        sort,
      ),
    [
      pool,
      searching,
      query,
      rewayah,
      completeOnly,
      downloadedOnly,
      downloadedIds,
      sort,
    ],
  );

  // ── Rewayah chips ─────────────────────────────────────────────────────
  const allRewayat = useMemo(() => rewayahCounts(pool), [pool]);
  const chipRewayat = useMemo(() => {
    // Android has no native menu for "More", so every rewayah is a chip.
    const top = nativeMenusAvailable
      ? allRewayat.slice(0, CHIP_REWAYAT)
      : allRewayat;
    const ids = top.map(r => r.id);
    if (rewayah && !ids.includes(rewayah)) ids.push(rewayah);
    return ids;
  }, [allRewayat, rewayah]);
  const moreRewayat = useMemo(
    () =>
      nativeMenusAvailable ? allRewayat.slice(CHIP_REWAYAT).map(r => r.id) : [],
    [allRewayat],
  );
  const moreEntries = useMemo<NativeMenuEntry[]>(() => {
    const groups = new Map<string, RewayahId[]>();
    for (const id of moreRewayat) {
      const qari = getQari(id);
      groups.set(qari, [...(groups.get(qari) ?? []), id]);
    }
    return [...groups].map(([qari, ids]) => ({
      id: `qari:${qari}`,
      title: getQariLabel(qari as Parameters<typeof getQariLabel>[0]),
      items: ids.map(id => ({
        id: `rewayah:${id}`,
        title: getNarratorLabel(id),
        checked: rewayah === id,
      })),
    }));
  }, [moreRewayat, rewayah]);

  // ── Preview ───────────────────────────────────────────────────────────
  const preview = useReciterPreview({
    resumeMain: true,
    maxSeconds: PREVIEW_SECONDS,
  });
  const previewRewayatId = useCallback(
    (reciter: Reciter) =>
      pickRewayatId(
        reciter.rewayat,
        [
          recordingFor(reciter, rewayah)?.id,
          useSettings.getState().reciterPreferences[reciter.id],
        ],
        surahId ?? 1,
      ) ?? reciter.rewayat[0]?.id,
    [rewayah, surahId],
  );
  const playingId = preview.playingKey?.split(':')[0] ?? null;
  const togglePreview = useCallback(
    (reciter: Reciter) => {
      const rewayatId = previewRewayatId(reciter);
      if (!rewayatId) return;
      Keyboard.dismiss();
      preview.toggle(reciter, rewayatId, surahId);
    },
    [preview, previewRewayatId, surahId],
  );

  // ── Sections and list items ───────────────────────────────────────────
  const isSearch = searching && query.trim().length > 0;
  const byLetter =
    !isSearch && sort === 'name' && reciters.length >= LETTERS_FROM;
  const sections = useMemo<BrowseSection[]>(() => {
    const list = letterSections(reciters, byLetter);
    if (!surahId || isSearch) return list;
    // Choosing for a surah: your favourites that have it come first.
    const shown = new Set(reciters.map(r => r.id));
    const yours = favoriteReciters
      .filter(f => shown.has(f.id))
      .map(f => reciters.find(r => r.id === f.id)!)
      .filter(Boolean);
    if (yours.length === 0) return list;
    return [
      {key: 'yours', title: t('browse.yourReciters'), reciters: yours},
      ...list.map(section =>
        section.title ? section : {...section, title: t('browse.reciters')},
      ),
    ];
  }, [reciters, byLetter, surahId, isSearch, favoriteReciters, t]);

  const pageMargin = isTablet ? moderateScale(24) : PANEL_MARGIN;
  const columns = Math.max(
    3,
    Math.floor(
      (windowWidth - pageMargin * 2 + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP),
    ),
  );
  const cardWidth =
    (windowWidth - pageMargin * 2 - CARD_GAP * (columns - 1)) / columns;
  const items = useMemo(
    () => buildBrowseItems(sections, view, columns),
    [sections, view, columns],
  );
  const flatReciters = useMemo(
    () => sections.flatMap(s => s.reciters),
    [sections],
  );
  const letters = useMemo(
    () =>
      byLetter && view === 'list'
        ? sections.filter(s => s.letter).map(s => s.letter!)
        : [],
    [byLetter, view, sections],
  );

  const playNext = useCallback(() => {
    const i = flatReciters.findIndex(r => r.id === playingId);
    const next = flatReciters[i + 1];
    if (!next) {
      preview.stop();
      return;
    }
    togglePreview(next);
    const index = items.findIndex(
      item =>
        (item.type === 'row' && item.reciter.id === next.id) ||
        (item.type === 'cards' && item.reciters.some(r => r.id === next.id)),
    );
    if (index >= 0) {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.4,
      });
    }
  }, [flatReciters, playingId, preview, togglePreview, items]);

  const jumpToLetter = useCallback(
    (letter: string) => {
      const index = items.findIndex(
        item => item.type === 'header' && item.letter === letter,
      );
      // With the glass header the list scrolls under it, so a section's
      // letter would land behind the header without this offset.
      if (index >= 0) {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewOffset: USE_GLASS ? -headerHeight : 0,
        });
      }
    },
    [items, headerHeight],
  );

  // ── Opening and picking ───────────────────────────────────────────────
  const handleReciterPress = useCallback(
    async (reciter: Reciter) => {
      Keyboard.dismiss();
      const match = recordingFor(reciter, rewayah);
      if (match?.id) setReciterPreference(reciter.id, match.id);

      if (!surahId) {
        preview.stop();
        router.push({
          pathname: profilePathname,
          params: {id: reciter.id, ...(match?.id ? {rewayatId: match.id} : {})},
        });
        return;
      }
      // One pick closes this screen once, without waiting for the audio:
      // a second tap or the user's own Back used to pop an extra screen.
      if (pickingRef.current) return;
      pickingRef.current = true;
      try {
        preview.stop();
        const surah = getSurahById(surahId);
        const rewayatId = pickRewayatId(
          reciter.rewayat,
          [match?.id, useSettings.getState().reciterPreferences[reciter.id]],
          surahId,
        );
        if (!surah || !rewayatId) {
          pickingRef.current = false;
          return;
        }
        const tracks = await createTracksForReciter(
          reciter,
          [surah],
          rewayatId,
        );
        startNewChain(reciter, surah, 0, 0, rewayatId);
        router.back();
        // Not awaited: it starts playback once the audio has loaded and
        // reports a failed load on its own.
        updateQueue(tracks, 0).catch(error => {
          console.error('Error playing surah:', error);
        });
      } catch (error) {
        pickingRef.current = false;
        console.error('Error playing surah:', error);
      }
    },
    [
      rewayah,
      surahId,
      setReciterPreference,
      preview,
      router,
      profilePathname,
      startNewChain,
      updateQueue,
    ],
  );

  // ── Header ────────────────────────────────────────────────────────────
  const menuEntries = useMemo<NativeMenuEntry[]>(
    () => [
      {
        id: 'view',
        items: [
          {
            id: 'view:list',
            title: t('browse.viewList'),
            systemImage: 'list.bullet',
            checked: view === 'list',
          },
          {
            id: 'view:cards',
            title: t('browse.viewCards'),
            systemImage: 'square.grid.3x2',
            checked: view === 'cards',
          },
        ],
      },
      {
        id: 'sort',
        title: t('browse.sortBy'),
        items: [
          {
            id: 'sort:name',
            title: t('browse.sortName'),
            checked: sort === 'name',
          },
          {
            id: 'sort:recent',
            title: t('browse.sortRecent'),
            checked: sort === 'recent',
          },
        ],
      },
      {
        id: 'show',
        title: t('browse.showOnly'),
        items: [
          {
            id: 'show:complete',
            title: t('browse.completeQuran'),
            checked: completeOnly,
          },
          {
            id: 'show:downloaded',
            title: t('browse.downloaded'),
            checked: downloadedOnly,
          },
        ],
      },
    ],
    [view, sort, completeOnly, downloadedOnly, t],
  );
  const onMenuSelect = useCallback(
    (id: string) => {
      const [kind, value] = id.split(':');
      if (kind === 'view') setView(value === 'cards' ? 'grid' : 'list');
      else if (kind === 'sort') setSort(value);
      else if (value === 'complete') setCompleteOnly(on => !on);
      else if (value === 'downloaded') setDownloadedOnly(on => !on);
    },
    [setView, setSort],
  );
  const filtered = completeOnly || downloadedOnly;

  const headerActions = (
    <View style={styles.headerActions}>
      <Pressable
        onPress={() => setSearching(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('common:actions.search')}>
        <SearchIcon size={moderateScale(20)} color={theme.colors.text} />
      </Pressable>
      {nativeMenusAvailable ? (
        <NativeMenu
          entries={menuEntries}
          onSelect={onMenuSelect}
          accessibilityLabel={t('browse.viewMenu')}>
          <View>
            {Platform.OS === 'ios' ? (
              <SymbolView
                name="line.3.horizontal.decrease"
                size={moderateScale(20)}
                tintColor={theme.colors.text}
                weight="medium"
              />
            ) : (
              <MaterialIcons
                name="sort"
                size={moderateScale(20)}
                color={theme.colors.text}
              />
            )}
            {filtered ? <View style={styles.menuDot} /> : null}
          </View>
        </NativeMenu>
      ) : (
        <Pressable
          onPress={() => setView(view === 'list' ? 'grid' : 'list')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            view === 'list' ? t('browse.viewCards') : t('browse.viewList')
          }>
          <Feather
            name={view === 'list' ? 'grid' : 'list'}
            size={moderateScale(20)}
            color={theme.colors.text}
          />
        </Pressable>
      )}
    </View>
  );

  const screenTitle = title ?? t('browse.reciters');
  useLayoutEffect(() => {
    if (!USE_GLASS) return;
    navigation.setOptions({
      ...(title ? {} : {headerTitle: screenTitle}),
      ...tintedHeaderRight(searching ? undefined : () => headerActions),
    });
  });

  useEffect(() => () => preview.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendering ─────────────────────────────────────────────────────────
  const itemProps = useCallback(
    (reciter: Reciter): ReciterItemProps => ({
      reciter,
      name: getReciterDisplayName(reciter),
      line: reciterLine(reciter, count => t('browse.surahCount', {count})),
      downloaded: downloadedIds.has(reciter.id),
      favorite: isFavoriteReciter(reciter.id),
      preview:
        preview.playingKey &&
        preview.playingKey === previewKey(reciter.id, previewRewayatId(reciter))
          ? {progress: preview.progress, elapsed: preview.elapsed}
          : null,
      trailing: surahId ? 'play' : 'heart',
      onPress: handleReciterPress,
      onPreview: togglePreview,
      onNext: playNext,
      onToggleFavorite: toggleFavorite,
    }),
    [
      t,
      downloadedIds,
      isFavoriteReciter,
      preview.playingKey,
      preview.progress,
      preview.elapsed,
      previewRewayatId,
      surahId,
      handleReciterPress,
      togglePreview,
      playNext,
      toggleFavorite,
    ],
  );

  const renderItem = useCallback(
    ({item}: {item: BrowseItem}) => {
      if (item.type === 'header') {
        return (
          <Text
            style={[groupedHeaderStyle(theme), styles.sectionHeader]}
            accessibilityRole="header">
            {item.title}
          </Text>
        );
      }
      if (item.type === 'row') {
        return (
          <ReciterPanelRow
            {...itemProps(item.reciter)}
            first={item.first}
            last={item.last}
          />
        );
      }
      return (
        <View style={[styles.cardRow, {paddingHorizontal: pageMargin}]}>
          {item.reciters.map(reciter => (
            <ReciterCard
              key={reciter.id}
              {...itemProps(reciter)}
              width={cardWidth}
            />
          ))}
        </View>
      );
    },
    [theme, styles, itemProps, pageMargin, cardWidth],
  );

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.chips,
        // Letter headers bring their own gap; bare rows and cards need one.
        items[0] && items[0].type !== 'header' && styles.chipsAboveRows,
      ]}>
      <Chip
        label={t('home:browse.allChip')}
        selected={rewayah === null}
        onPress={() => setRewayah(null)}
        styles={styles}
      />
      {chipRewayat.map(id => (
        <Chip
          key={id}
          label={rewayahChipLabel(id, chipRewayat)}
          selected={rewayah === id}
          onPress={() => setRewayah(current => (current === id ? null : id))}
          styles={styles}
        />
      ))}
      {moreEntries.length > 0 ? (
        <NativeMenu
          entries={moreEntries}
          title={t('browse.moreRewayat')}
          onSelect={id => {
            const value = id.split(':')[1] as RewayahId;
            setRewayah(current => (current === value ? null : value));
          }}
          accessibilityLabel={t('browse.moreRewayatTitle')}>
          <View style={[styles.chip, styles.moreChip]}>
            <Text style={styles.chipText}>{t('browse.moreRewayat')}</Text>
            <Feather
              name="chevron-down"
              size={moderateScale(13)}
              color={theme.colors.text}
            />
          </View>
        </NativeMenu>
      ) : null}
    </ScrollView>
  );

  const listHeader = (
    <View>
      {!USE_GLASS && !searching ? (
        <View style={styles.inlineTitleRow}>
          <Text style={styles.inlineTitle} accessibilityRole="header">
            {screenTitle}
          </Text>
          {headerActions}
        </View>
      ) : null}
      {searching ? (
        <CollectionSearchField
          value={query}
          onChangeText={setQuery}
          onCancel={stopSearching}
          placeholder={t('browse.searchReciters')}
          style={styles.searchField}
        />
      ) : null}
      {chips}
    </View>
  );

  const empty =
    items.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Feather
            name={isSearch ? 'search' : 'users'}
            size={moderateScale(26)}
            color={Color(theme.colors.text).alpha(0.5).toString()}
          />
        </View>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          {isSearch
            ? t('browse.noResultsTitle', {query: query.trim()})
            : t('browse.noMatchTitle')}
        </Text>
        <Text style={styles.emptyBody}>
          {isSearch ? t('browse.noResultsBody') : t('browse.noMatchBody')}
        </Text>
        {!isSearch ? (
          <Pressable
            onPress={clearFilters}
            accessibilityRole="button"
            style={({pressed}) => [
              styles.emptyButton,
              pressed && {opacity: 0.7},
            ]}>
            <Text style={styles.emptyButtonText}>{t('browse.showAll')}</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      {!USE_GLASS ? (
        <Header
          title={screenTitle}
          onBack={onBack}
          showBlur
          containerStyle={{zIndex: 2}}
        />
      ) : null}
      <FlashList
        // A new view, order or filter is a new list, so it starts from the
        // top instead of keeping an offset that may point past its end.
        // (Scrolling there by hand cannot: the glass header's inset makes
        // the top a negative offset, which the scroll view clamps to 0.)
        key={[view, sort, completeOnly, downloadedOnly].join('|')}
        ref={listRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        getItemType={item => item.type}
        extraData={itemProps}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={{
          paddingTop: USE_GLASS ? 0 : insets.top + moderateScale(56),
          paddingBottom: Math.max(moderateScale(80), bottomInset),
        }}
        drawDistance={moderateScale(400)}
      />
      {letters.length > 0 && !searching ? (
        <AlphabetRail
          letters={letters}
          onLetter={jumpToLetter}
          insetTop={USE_GLASS ? headerHeight : insets.top + moderateScale(56)}
          insetBottom={Math.max(moderateScale(80), bottomInset)}
        />
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      accessibilityRole="togglebutton"
      accessibilityState={{selected}}
      style={({pressed}) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && {opacity: 0.7},
      ]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(20),
      paddingHorizontal: moderateScale(6),
    },
    menuDot: {
      position: 'absolute',
      top: -moderateScale(2),
      end: -moderateScale(3),
      width: moderateScale(7),
      height: moderateScale(7),
      borderRadius: moderateScale(4),
      backgroundColor: theme.colors.text,
    },
    inlineTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(4),
    },
    inlineTitle: {
      fontSize: moderateScale(28),
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.text,
    },
    searchField: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(4),
      paddingBottom: moderateScale(4),
    },
    chips: {
      flexDirection: 'row',
      gap: moderateScale(6),
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(4),
    },
    chipsAboveRows: {paddingBottom: moderateScale(14)},
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(3),
      paddingHorizontal: moderateScale(13),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    chipSelected: {backgroundColor: theme.colors.text},
    moreChip: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: Color(theme.colors.text).alpha(0.18).toString(),
    },
    chipText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    chipTextSelected: {color: theme.colors.background},
    sectionHeader: {
      paddingHorizontal: PANEL_MARGIN + PANEL_ROW_PADDING,
      paddingTop: GROUPED_SECTION_GAP,
      paddingBottom: GROUPED_HEADER_GAP,
    },
    cardRow: {
      flexDirection: 'row',
      gap: CARD_GAP,
      marginBottom: CARD_GAP,
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: moderateScale(32),
      paddingTop: moderateScale(64),
      gap: moderateScale(8),
    },
    emptyIcon: {
      width: moderateScale(64),
      height: moderateScale(64),
      borderRadius: moderateScale(32),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: moderateScale(6),
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    emptyTitle: {
      fontSize: moderateScale(17),
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.6).toString(),
      textAlign: 'center',
      lineHeight: moderateScale(19),
    },
    emptyButton: {
      marginTop: moderateScale(10),
      paddingHorizontal: moderateScale(22),
      height: moderateScale(42),
      borderRadius: moderateScale(12),
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
    emptyButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-ExtraBold',
      color: theme.colors.background,
    },
  });
