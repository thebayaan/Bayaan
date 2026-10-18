import React, {useMemo} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {HomeHero, type HeroArt} from '../components/home/HomeHero';
import {HomeClock} from '../components/home/HomeClock';
import {HomeGlow} from '../components/home/HomeGlow';
import {HomeRail, HOME_GUTTER} from '../components/home/HomeRail';
import {ContinueWideCard} from '../components/home/ContinueWideCard';
import {AdhkarTile, SurahTile} from '../components/home/MomentTiles';
import {ReciterPortrait} from '../components/home/ReciterPortrait';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useFavorites} from '../hooks/useFavorites';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {playOrOpen} from '../services/playbackRouting';
import {useClock} from '../hooks/useClock';
import {
  adhkarFacts,
  adhkarTileMeta,
  estimateAdhkarMinutes,
  homePlanAt,
  homeSections,
  quickPicks,
  surahFacts,
  type HomeHero as HeroPlan,
  type HomeSection,
  type MomentItem,
} from '../hooks/homeMoments';
import {pickHomeReciters} from '../hooks/homeReciters';
import {useNavStore} from '../store/navStore';
import {getDefaultReciter} from '../services/tvDataService';
import {adhkarForList, adhkarList} from '../services/adhkarData';
import type {Reciter} from '../types/reciter';
import type {ContinueEntry} from '../services/continueListeningStore';
import {SURAHS} from '../../data/surahData';
import {surahGlow} from '../theme/surahColors';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';
import {SCREEN_CLOCK_RIGHT, SCREEN_CLOCK_TOP} from '../theme/spacing';

const surahNameMap = new Map<number, string>(SURAHS.map(s => [s.id, s.name]));

function surahName(n: number): string {
  return surahNameMap.get(n) ?? `Surah ${n}`;
}

type AdhkarSummary = {
  listId: string;
  title: string;
  arabicTitle: string;
  color: string;
  count: number;
  minutes: number;
};

function adhkarSummary(listId: string): AdhkarSummary | null {
  const list = adhkarList(listId);
  if (!list) return null;
  const items = adhkarForList(listId);
  return {
    listId,
    title: list.title,
    arabicTitle: list.arabicTitle,
    color: list.color,
    count: items.length,
    minutes: estimateAdhkarMinutes(items),
  };
}

type HeroView = {
  kicker: string;
  title: string;
  sentence: string;
  art: HeroArt;
  glow: readonly string[];
  primaryLabel: string;
  secondaryLabel: string;
  /** The surah the primary plays, or null when it opens adhkar. */
  primarySurah: number | null;
  listId: string | null;
  /** The surah the secondary plays, or null when it opens Reciters. */
  insteadSurah: number | null;
};

function heroView(plan: HeroPlan, reciterName: string | null): HeroView {
  if (plan.kind === 'adhkar') {
    const summary = adhkarSummary(plan.listId);
    return {
      kicker: plan.kicker,
      title: plan.title,
      sentence: summary ? adhkarFacts(summary.count, summary.minutes) : '',
      art: {kind: 'arabic', text: summary?.arabicTitle ?? ''},
      glow: summary ? [summary.color, summary.color, summary.color] : [],
      primaryLabel: 'Begin',
      secondaryLabel: `${surahName(plan.insteadSurah)} instead`,
      primarySurah: null,
      listId: plan.listId,
      insteadSurah: plan.insteadSurah,
    };
  }
  return {
    kicker: plan.kicker,
    title: surahName(plan.surahNumber),
    sentence: `${plan.lead} ${surahFacts(plan.surahNumber, reciterName)}`,
    art: {kind: 'surah', surahNumber: plan.surahNumber},
    glow: surahGlow(plan.surahNumber),
    primaryLabel: 'Play',
    secondaryLabel: 'Another reciter',
    primarySurah: plan.surahNumber,
    listId: null,
    insteadSurah: null,
  };
}

/**
 * Home: a hero that follows the day (adhkar after Fajr and in the evening,
 * Al-Kahf on Friday, Al-Mulk at night, a surah of the day otherwise), the
 * clock, then at most two rails: Continue listening and the moment's rail,
 * or Quick picks and reciters on a first launch.
 */
export function HomeScreen(): React.ReactElement {
  const {reciters, loading} = useReciters();
  const continueEntries = useContinueListening();
  const favorites = useFavorites();
  const recent = useRecentlyPlayed();
  const {defaultReciterId} = useDefaultReciter();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);
  const now = useClock();

  // Re-plan when the hour turns, not on every minute tick.
  const hourStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
  ).getTime();
  const plan = useMemo(() => homePlanAt(new Date(hourStart)), [hourStart]);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  // Home plays with the default reciter, or the app's pick until one is set.
  const playReciter = useMemo<Reciter | null>(
    () =>
      (defaultReciterId ? reciterById.get(defaultReciterId) : undefined) ??
      getDefaultReciter(reciters),
    [defaultReciterId, reciterById, reciters],
  );

  const hero = useMemo(
    () => heroView(plan.hero, playReciter?.name ?? null),
    [plan.hero, playReciter],
  );

  const homeReciters = useMemo(
    () =>
      pickHomeReciters({
        reciters,
        favoriteIds: favorites.map(f => f.reciterId),
        recentIds: recent.map(e => e.reciterId),
        defaultId: defaultReciterId,
      }),
    [reciters, favorites, recent, defaultReciterId],
  );

  const sections = homeSections({
    hasContinue: continueEntries.length > 0,
    hasHistory: recent.length > 0 || favorites.length > 0,
    hasMoments: (plan.moments?.items.length ?? 0) > 0,
  });

  // playOrOpen opens the player at once and shows any failure there; the
  // track already playing just opens.
  function playSurah(surahNumber: number): void {
    const reciter = playReciter;
    if (!reciter) return;
    void playOrOpen({reciterId: reciter.id, surahNumber, source: 'home'});
  }

  function openAdhkar(listId: string): void {
    push({screen: 'adhkarReader', listId});
  }

  function handleContinue(entry: ContinueEntry): void {
    void playOrOpen({
      reciterId: entry.reciterId,
      rewayahId: entry.rewayahId || undefined,
      surahNumber: entry.surahNumber,
      startSeconds: entry.positionSeconds,
      source: 'home-continue',
    });
  }

  function handleReciter(reciter: Reciter): void {
    push({screen: 'reciterDetail', reciterId: reciter.id});
  }

  function handlePrimary(): void {
    if (hero.listId) openAdhkar(hero.listId);
    else if (hero.primarySurah) playSurah(hero.primarySurah);
  }

  function handleSecondary(): void {
    if (hero.insteadSurah) playSurah(hero.insteadSurah);
    else switchTab('reciters');
  }

  function renderMoment(item: MomentItem): React.ReactElement | null {
    if (item.kind === 'surah') {
      return (
        <SurahTile
          key={`s${item.surahNumber}`}
          surahNumber={item.surahNumber}
          surahName={surahName(item.surahNumber)}
          onSelect={playSurah}
        />
      );
    }
    const summary = adhkarSummary(item.listId);
    if (!summary) return null;
    return (
      <AdhkarTile
        key={`a${item.listId}`}
        listId={summary.listId}
        title={summary.title}
        arabicTitle={summary.arabicTitle}
        color={summary.color}
        meta={adhkarTileMeta(summary.count, summary.minutes)}
        onSelect={openAdhkar}
      />
    );
  }

  function renderSection(section: HomeSection): React.ReactNode {
    switch (section) {
      case 'continue':
        return (
          <HomeRail key="continue" title="Continue listening">
            {continueEntries.map(e => (
              <ContinueWideCard
                key={`${e.reciterId}:${e.surahNumber}`}
                entry={e}
                surahName={surahName(e.surahNumber)}
                reciterName={reciterById.get(e.reciterId)?.name ?? ''}
                onSelect={handleContinue}
              />
            ))}
          </HomeRail>
        );
      case 'moments':
        return plan.moments ? (
          <HomeRail key="moments" title={plan.moments.title}>
            {plan.moments.items.map(renderMoment)}
          </HomeRail>
        ) : null;
      case 'quickPicks':
        return (
          <HomeRail key="quickPicks" title="Quick picks">
            {quickPicks(hero.primarySurah).map(n => (
              <SurahTile
                key={n}
                surahNumber={n}
                surahName={surahName(n)}
                onSelect={playSurah}
              />
            ))}
          </HomeRail>
        );
      case 'reciters':
        if (homeReciters.reciters.length === 0) {
          return (
            <Text key="reciters" style={styles.status}>
              {loading ? 'Loading reciters…' : 'Reciters are unavailable.'}
            </Text>
          );
        }
        return (
          <HomeRail key="reciters" title={homeReciters.title}>
            {homeReciters.reciters.map(r => (
              <ReciterPortrait
                key={r.id}
                reciter={r}
                onSelect={handleReciter}
              />
            ))}
          </HomeRail>
        );
    }
  }

  return (
    <View style={styles.container}>
      <HomeGlow palette={hero.glow} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <HomeHero
          kicker={hero.kicker}
          title={hero.title}
          sentence={hero.sentence}
          art={hero.art}
          primaryLabel={hero.primaryLabel}
          onPrimary={handlePrimary}
          secondaryLabel={hero.secondaryLabel}
          onSecondary={handleSecondary}
        />
        {sections.map(renderSection)}
      </ScrollView>
      <View style={styles.clock} pointerEvents="none">
        <HomeClock now={now} />
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: HOME_GUTTER,
    paddingTop: 40,
    paddingBottom: 90,
  },
  clock: {
    position: 'absolute',
    top: SCREEN_CLOCK_TOP,
    right: SCREEN_CLOCK_RIGHT,
  },
  status: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
    marginTop: 24,
  },
});
