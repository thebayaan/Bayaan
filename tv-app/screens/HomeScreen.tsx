import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {ContinueCard} from '../components/rails/ContinueCard';
import {QuickPlayCard} from '../components/rails/QuickPlayCard';
import {SeeAllCard} from '../components/rails/SeeAllCard';
import {FeaturedBanner} from '../components/rails/FeaturedBanner';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {fetchRewayat} from '../services/tvDataService';
import type {Reciter} from '../types/reciter';
import type {ContinueEntry} from '../services/continueListeningStore';
import SURAHS from '../../data/surahData.json';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';

const QUICK_PLAY_SURAHS = [1, 18, 67, 55, 36, 112];

type SurahMeta = {id: number; name: string};

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 4) return 'Peaceful night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const continueEntries = useContinueListening();
  const {defaultReciterId} = useDefaultReciter();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);

  const surahByNumber = useMemo(() => {
    const map = new Map<number, string>();
    (SURAHS as SurahMeta[]).forEach(s => map.set(s.id, s.name));
    return map;
  }, []);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  const spotlight = reciters[0] ?? null;
  const featured = reciters.slice(1, 9);
  const all = reciters.slice(0, 12);

  async function handleReciterSelect(reciter: Reciter): Promise<void> {
    push({screen: 'reciterDetail', reciterId: reciter.id});
  }

  async function handleContinueSelect(entry: ContinueEntry): Promise<void> {
    const reciter = reciterById.get(entry.reciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(entry.reciterId);
    const rewayah = rewayat.find(r => r.id === entry.rewayahId) ?? rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, entry.surahNumber);
    push({screen: 'nowPlaying'});
  }

  async function handleQuickPlay(surahNumber: number): Promise<void> {
    if (!defaultReciterId) return;
    const reciter = reciterById.get(defaultReciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(defaultReciterId);
    const rewayah = rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, surahNumber);
    push({screen: 'nowPlaying'});
  }

  const hasContinue = continueEntries.length > 0;
  const greeting = timeOfDayGreeting();

  return (
    <View style={styles.container}>
      <TopTabBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>
        {spotlight && (
          <FeaturedBanner
            reciter={spotlight}
            onSelect={handleReciterSelect}
            hasTVPreferredFocus={!hasContinue}
          />
        )}

        {hasContinue && (
          <Rail title="Continue Listening">
            {continueEntries.map((e, i) => (
              <ContinueCard
                key={`${e.reciterId}:${e.surahNumber}`}
                entry={e}
                reciter={reciterById.get(e.reciterId) ?? null}
                surahName={
                  surahByNumber.get(e.surahNumber) ?? `Surah ${e.surahNumber}`
                }
                onSelect={handleContinueSelect}
                hasTVPreferredFocus={i === 0}
              />
            ))}
          </Rail>
        )}

        <Rail title="Featured Reciters">
          {featured.map(r => (
            <ReciterCard
              key={r.id}
              reciter={r}
              onSelect={handleReciterSelect}
            />
          ))}
        </Rail>

        <Rail title="All Reciters">
          {all.map(r => (
            <ReciterCard
              key={r.id}
              reciter={r}
              onSelect={handleReciterSelect}
            />
          ))}
          <SeeAllCard onSelect={() => push({screen: 'catalogGrid'})} />
        </Rail>

        <Rail title="Quick Play">
          {QUICK_PLAY_SURAHS.map(n => (
            <QuickPlayCard
              key={n}
              surahNumber={n}
              surahName={surahByNumber.get(n) ?? `Surah ${n}`}
              onSelect={handleQuickPlay}
            />
          ))}
        </Rail>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {marginBottom: 4},
  greeting: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
});
