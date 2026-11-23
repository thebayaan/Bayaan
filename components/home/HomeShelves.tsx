// @ai-generated
// The lower half of Home: adhkar, explore by rewayah, the reciter
// collections grouped in one panel, and the listener's own playlists.
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {localizeDigits} from '@/i18n/format';
import {useAdhkarStore} from '@/store/adhkarStore';
import {AdhkarBentoCard} from '@/components/adhkar/AdhkarBentoCard';
import type {SuperCategory} from '@/types/adhkar';
import {getAllRewayatTypes} from '@/data/rewayatCollections';
import RewayatCard from '@/components/cards/RewayatCard';
import {usePlaylists} from '@/hooks/usePlaylists';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import {useTimestampStore} from '@/store/timestampStore';
import type {HomeRowId} from '@/config/branding';
import {
  PANEL_ART_GAP,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
  usePanelColor,
} from '@/components/collection/CollectionPanel';
import {
  HomeSectionTitle,
  HomeSymbol,
  PressScale,
  ReciterFaces,
  secondaryText,
  useCatalogVersion,
  ignoreHaptics,
} from './homeKit';
import {HOME_COLLECTIONS} from './homeCollections';

const SHELF_GAP = moderateScale(10);
const FACE = moderateScale(40);
/** Two faces, the second overlapping the first by a third. */
const FACES_WIDTH = FACE * 2 - FACE * 0.32;

function Shelf({children}: {children: React.ReactNode}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelf}>
      {children}
    </ScrollView>
  );
}

export function AdhkarShelf() {
  const {t} = useTranslation(['home', 'common']);
  const router = useRouter();
  const main = useAdhkarStore(s => s.mainSuperCategories);
  const loaded = useAdhkarStore(s => s.superCategoriesLoaded);
  // The adhkar screen's two columns, read across: morning, evening…
  const categories = useMemo(() => {
    const byColumn = (column: 'left' | 'right') =>
      main
        .filter(c => c.column === column)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    const left = byColumn('left');
    const right = byColumn('right');
    const out: SuperCategory[] = [];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if (left[i]) out.push(left[i]);
      if (right[i]) out.push(right[i]);
    }
    return out;
  }, [main]);
  if (!loaded || categories.length === 0) return null;
  return (
    <View>
      <HomeSectionTitle
        title={t('common:terms.adhkar')}
        action={t('seeAll')}
        onAction={() => router.push('/(tabs)/(a.home)/adhkar')}
      />
      <Shelf>
        {categories.map(category => (
          <AdhkarBentoCard
            key={category.id}
            category={category}
            width={moderateScale(142)}
            height={moderateScale(100)}
          />
        ))}
      </Shelf>
    </View>
  );
}

export function RewayahShelf() {
  const {t} = useTranslation('home');
  const router = useRouter();
  const rewayat = useMemo(() => getAllRewayatTypes(), []);
  if (rewayat.length === 0) return null;
  return (
    <View>
      <HomeSectionTitle title={t('home.exploreByRewayah')} />
      <Shelf>
        {rewayat.map(r => (
          <RewayatCard
            key={r.id}
            rewayat={r}
            width={moderateScale(132)}
            height={moderateScale(110)}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(a.home)/reciter/browse',
                params: {
                  teacher: r.teacher,
                  student: r.student,
                  rewayatName: r.displayName,
                },
              })
            }
          />
        ))}
      </Shelf>
    </View>
  );
}

/** The reciter collections as rows of one panel. */
export function CollectionsPanel({enabled}: {enabled: ReadonlySet<HomeRowId>}) {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const router = useRouter();
  const panel = usePanelColor();
  const catalogVersion = useCatalogVersion();
  const registryLoaded = useTimestampStore(s => s.registryLoaded);
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);

  const rows = useMemo(
    () =>
      HOME_COLLECTIONS.filter(c => enabled.has(c.id))
        .map(c => ({...c, list: c.reciters()}))
        .filter(c => c.list.length > 0),
    // The follow-along list fills once the timestamp registry loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, catalogVersion, registryLoaded],
  );
  if (rows.length === 0) return null;

  return (
    <View>
      <HomeSectionTitle title={t('collections.title')} />
      {rows.map((c, i) => {
        const title = t(c.titleKey);
        const count = t('collections.reciterCount', {
          count: c.list.length,
          formatted: localizeDigits(c.list.length),
        });
        return (
          <PanelRow
            key={c.id}
            first={i === 0}
            last={i === rows.length - 1}
            artWidth={FACES_WIDTH}>
            <PressScale
              onPress={() => {
                Haptics.selectionAsync().catch(ignoreHaptics);
                router.push({
                  pathname: '/(tabs)/(a.home)/reciters/[collection]',
                  params: {collection: c.id},
                });
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${count}`}
              style={styles.collectionRow}>
              <View style={styles.faces}>
                <ReciterFaces
                  reciters={c.list.slice(0, 2)}
                  size={FACE}
                  ring={panel}
                />
              </View>
              <View style={styles.collectionText}>
                <Text
                  style={[styles.collectionTitle, {color: theme.colors.text}]}
                  numberOfLines={1}>
                  {title}
                </Text>
                <Text
                  style={[styles.collectionCount, {color: secondary}]}
                  numberOfLines={1}>
                  {count}
                </Text>
              </View>
              <HomeSymbol
                name="chevron"
                size={moderateScale(13)}
                color={secondary}
                weight="bold"
              />
            </PressScale>
          </PanelRow>
        );
      })}
    </View>
  );
}

export function PlaylistsShelf() {
  const {t} = useTranslation('home');
  const router = useRouter();
  const {playlists} = usePlaylists();
  if (playlists.length === 0) return null;
  return (
    <View>
      <HomeSectionTitle title={t('home.yourPlaylists')} />
      <Shelf>
        {playlists.slice(0, 12).map(p => (
          <PlaylistCard
            key={p.id}
            name={p.name}
            itemCount={p.itemCount}
            color={p.color}
            playlistId={p.id}
            width={moderateScale(118)}
            height={moderateScale(118)}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/(a.home)/playlist/[id]',
                params: {id: p.id},
              })
            }
          />
        ))}
      </Shelf>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    paddingHorizontal: moderateScale(16),
    gap: SHELF_GAP,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL + moderateScale(4),
    gap: PANEL_ART_GAP,
  },
  faces: {
    width: FACES_WIDTH,
  },
  collectionText: {
    flex: 1,
    minWidth: 0,
  },
  collectionTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  collectionCount: {
    marginTop: moderateScale(1),
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(13),
    textAlign: 'left',
  },
});
