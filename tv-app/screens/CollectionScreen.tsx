import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {ReciterCard} from '../components/rails/ReciterCard';
import {ContinueCard} from '../components/rails/ContinueCard';
import {HeartIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useFavorites} from '../hooks/useFavorites';
import {useContinueListening} from '../hooks/useContinueListening';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {fetchRewayat} from '../services/tvDataService';
import type {ContinueEntry} from '../services/continueListeningStore';
import type {Reciter} from '../types/reciter';
import SURAHS from '../../data/surahData.json';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

type TabKey = 'favorites' | 'continue' | 'recent';

type SurahMeta = {id: number; name: string};

type TabDef = {
  key: TabKey;
  label: string;
  count: number;
};

export function CollectionScreen(): React.ReactElement {
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const recent = useRecentlyPlayed();
  const {reciters} = useReciters();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);
  const [tab, setTab] = useState<TabKey>('favorites');

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  const surahByNumber = useMemo(() => {
    const map = new Map<number, string>();
    (SURAHS as SurahMeta[]).forEach(s => map.set(s.id, s.name));
    return map;
  }, []);

  const favoriteReciters = useMemo(
    () =>
      favorites
        .map(f => reciterById.get(f.reciterId))
        .filter((r): r is Reciter => !!r),
    [favorites, reciterById],
  );

  const recentReciters = useMemo(
    () =>
      recent
        .map(e => reciterById.get(e.reciterId))
        .filter((r): r is Reciter => !!r),
    [recent, reciterById],
  );

  const tabs: TabDef[] = [
    {key: 'favorites', label: 'Favorites', count: favoriteReciters.length},
    {key: 'continue', label: 'Continue', count: continueEntries.length},
    {key: 'recent', label: 'Recently Played', count: recentReciters.length},
  ];

  async function handleContinueSelect(entry: ContinueEntry): Promise<void> {
    const reciter = reciterById.get(entry.reciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(entry.reciterId);
    const rewayah = rewayat.find(r => r.id === entry.rewayahId) ?? rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, entry.surahNumber);
    push({screen: 'nowPlaying'});
  }

  function renderFavorites(): React.ReactElement {
    if (favoriteReciters.length === 0) {
      return (
        <EmptyState
          icon={<HeartIcon color={colors.text} size={64} />}
          title="Nothing saved yet"
          sub="Open a reciter and tap Favorite to pin them here."
        />
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {favoriteReciters.map((r, i) => (
          <View key={r.id} style={styles.cell}>
            <ReciterCard
              reciter={r}
              onSelect={() => push({screen: 'reciterDetail', reciterId: r.id})}
              hasTVPreferredFocus={i === 0}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  function renderContinue(): React.ReactElement {
    if (continueEntries.length === 0) {
      return (
        <EmptyState
          title="No listening history"
          sub="Surahs you've started will show up here so you can pick up where you left off."
        />
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {continueEntries.map((e, i) => (
          <View key={`${e.reciterId}:${e.surahNumber}`} style={styles.cell}>
            <ContinueCard
              entry={e}
              reciter={reciterById.get(e.reciterId) ?? null}
              surahName={
                surahByNumber.get(e.surahNumber) ?? `Surah ${e.surahNumber}`
              }
              onSelect={handleContinueSelect}
              hasTVPreferredFocus={i === 0}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  function renderRecent(): React.ReactElement {
    if (recentReciters.length === 0) {
      return (
        <EmptyState
          title="Nothing played yet"
          sub="Reciters you've played will appear here for quick return."
        />
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {recentReciters.map((r, i) => (
          <View key={r.id} style={styles.cell}>
            <ReciterCard
              reciter={r}
              onSelect={() => push({screen: 'reciterDetail', reciterId: r.id})}
              hasTVPreferredFocus={i === 0}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  const total =
    favoriteReciters.length + continueEntries.length + recentReciters.length;

  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR LIBRARY</Text>
        <Text style={styles.pageTitle}>Collection</Text>
        {total > 0 ? (
          <Text style={styles.sub}>
            {total} {total === 1 ? 'item' : 'items'} saved
          </Text>
        ) : null}
      </View>
      <View style={styles.tabRow}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <FocusableButton
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityLabel={t.label}
              style={[styles.tab, active && styles.tabActive]}>
              <View style={styles.tabInner}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
                {t.count > 0 ? (
                  <View
                    style={[
                      styles.countPill,
                      active && styles.countPillActive,
                    ]}>
                    <Text
                      style={[
                        styles.countText,
                        active && styles.countTextActive,
                      ]}>
                      {t.count}
                    </Text>
                  </View>
                ) : null}
              </View>
            </FocusableButton>
          );
        })}
      </View>
      {tab === 'favorites' ? renderFavorites() : null}
      {tab === 'continue' ? renderContinue() : null}
      {tab === 'recent' ? renderRecent() : null}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  sub: string;
  icon?: React.ReactNode;
};

function EmptyState({title, sub, icon}: EmptyStateProps): React.ReactElement {
  return (
    <View style={styles.center}>
      {icon ? <View style={styles.iconHalo}>{icon}</View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: 6},
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.55,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {backgroundColor: colors.text},
  tabInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  tabText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  tabTextActive: {color: colors.background},
  countPill: {
    paddingHorizontal: 8,
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillActive: {backgroundColor: 'rgba(0,0,0,0.14)'},
  countText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countTextActive: {color: colors.background},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl - 8,
    paddingTop: 4,
    paddingBottom: spacing.xxl,
  },
  cell: {padding: 10},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptySub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 28,
    opacity: 0.75,
  },
});
