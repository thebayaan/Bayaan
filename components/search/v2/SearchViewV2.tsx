import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';
import {useLovedStore} from '@/services/player/store/lovedStore';
import {useFavoriteRecitersStore} from '@/store/favoriteRecitersStore';
import {useReciterStore} from '@/store/reciterStore';
import {getAllReciters} from '@/services/dataService';
import {SURAHS} from '@/data/surahData';
import {REWAYAT_REGISTRY} from '@/data/rewayat';
import type {Reciter} from '@/data/reciterData';
import {loadAdhkarCategories} from '@/services/search/adapters/adhkar';
import {loadAsma} from '@/services/search/adapters/names';
import {createOrchestrator} from '@/services/search/orchestrator';
import type {
  EntityType,
  RankedResult,
  SearchResponse,
} from '@/services/search/types';
import type {PersonalContext} from '@/services/search/personalSignals';
import {
  trackDismissed,
  trackResultTapped,
  trackSearchQuery,
} from '@/services/search/telemetry';
import {TabBar} from './TabBar';
import {RankedResultRow} from './RankedResultRow';

interface Props {
  query: string;
  isSearchActive: boolean;
  onResultPress: (r: RankedResult) => void;
}

const DEBOUNCE_MS = 200;

export function SearchViewV2({
  query,
  isSearchActive,
  onResultPress,
}: Props): React.ReactElement | null {
  const [reciters, setReciters] = useState<Reciter[]>([]);
  useEffect(() => {
    getAllReciters()
      .then(setReciters)
      .catch(() => setReciters([]));
  }, []);

  // favoriteReciters is FavoriteReciterWithTimestamp[] (extends Reciter), so .id is string
  const favoriteReciterIds = useFavoriteRecitersStore(
    s => new Set<string>(s.favoriteReciters.map(r => r.id)),
  );

  // lovedStore uses `tracks` (not `lovedTracks`); reciterId is already string
  const lovedReciterIds = useLovedStore(s => {
    const set = new Set<string>();
    for (const t of s.tracks) set.add(t.reciterId);
    return set;
  });

  // defaultReciter is a Reciter object; id is a string
  const defaultReciterId = useReciterStore(s =>
    s.defaultReciter.id !== '' ? s.defaultReciter.id : null,
  );

  const personalCtxProvider = useCallback(
    (): PersonalContext => ({
      lovedReciterIds: new Set<string>([
        ...favoriteReciterIds,
        ...lovedReciterIds,
      ]),
      lovedTrackIds: new Set<string>(),
      downloadedTrackIds: new Set<string>(),
      defaultReciterId,
      defaultRewayatId: null,
      recentResultIds: new Set<string>(),
    }),
    [favoriteReciterIds, lovedReciterIds, defaultReciterId],
  );

  const orchestrator = useMemo(
    () =>
      createOrchestrator({
        reciters,
        surahs: SURAHS,
        rewayat: [...REWAYAT_REGISTRY],
        adhkarCategories: loadAdhkarCategories(),
        names: loadAsma(),
        playlists: [],
        personalCtxProvider,
      }),
    [reciters, personalCtxProvider],
  );

  const [response, setResponse] = useState<SearchResponse>({
    query: '',
    results: [],
    tabs: [],
  });
  const [activeTab, setActiveTab] = useState<EntityType | 'all'>('all');
  const [computing, setComputing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResponse({query: '', results: [], tabs: []});
      return;
    }
    setComputing(true);
    timer.current = setTimeout(() => {
      const res = orchestrator.search({query});
      setResponse(res);
      setActiveTab(cur => (res.tabs.some(t => t.type === cur) ? cur : 'all'));
      setComputing(false);
      trackSearchQuery(query, activeTab);
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, orchestrator]);

  useEffect(() => {
    return () => {
      if (!isSearchActive && query) {
        trackDismissed(response.results.length > 0, query.length);
      }
    };
  }, [isSearchActive, query, response.results.length]);

  const visible = useMemo(() => {
    if (activeTab === 'all') return response.results;
    return response.results.filter(r => r.type === activeTab);
  }, [activeTab, response.results]);

  const handlePress = useCallback(
    (r: RankedResult) => {
      const position = visible.findIndex(x => x.id === r.id);
      trackResultTapped({
        entityType: r.type,
        position,
        score: r.features.finalScore,
        tier: r.features.tier,
        signal: r.features.signal,
        queryLength: query.length,
        tabActive: activeTab,
      });
      onResultPress(r);
    },
    [visible, query.length, activeTab, onResultPress],
  );

  if (!query.trim()) return null;

  return (
    <View style={styles.container}>
      <TabBar tabs={response.tabs} active={activeTab} onChange={setActiveTab} />
      {computing && (
        <View style={styles.loading}>
          <ActivityIndicator color="#d4af37" />
        </View>
      )}
      <FlatList
        data={visible}
        keyExtractor={r => r.id}
        renderItem={({item}) => (
          <RankedResultRow result={item} onPress={handlePress} />
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  loading: {paddingVertical: 6, alignItems: 'center'},
});
