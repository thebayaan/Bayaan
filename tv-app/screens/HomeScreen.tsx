import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, View, type LayoutChangeEvent} from 'react-native';
import {HomeHero, type HeroArt} from '../components/home/HomeHero';
import {HomeClock} from '../components/home/HomeClock';
import {HomeGlow} from '../components/home/HomeGlow';
import {HomeRail, HOME_GUTTER} from '../components/home/HomeRail';
import {ContinueWideCard} from '../components/home/ContinueWideCard';
import {AdhkarTile, ColorTile, SurahTile} from '../components/home/MomentTiles';
import {ReciterPortrait} from '../components/home/ReciterPortrait';
import {NowPlayingStrip} from '../components/home/NowPlayingStrip';
import {HeroReciterPicker} from '../components/home/HeroReciterPicker';
import {useReciters} from '../hooks/useReciters';
import {useContinueListening} from '../hooks/useContinueListening';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useFavorites} from '../hooks/useFavorites';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {useLovedSurahs} from '../hooks/useLovedSurahs';
import {usePlaylists} from '../hooks/usePlaylists';
import {formatWeekday, useClock} from '../hooks/useClock';
import {
  adhkarFacts,
  adhkarRowIds,
  adhkarTileMeta,
  estimateAdhkarMinutes,
  homePlanAt,
  homeRows,
  planHourOf,
  planListIds,
  surahCaption,
  surahFacts,
  surahListMeta,
  type HomeHero as HeroPlan,
  type HomeRow,
  type MomentItem,
} from '../hooks/homeMoments';
import {
  featuredRow,
  hasReciterChoice,
  homeVoiceCandidates,
  preferredReciterIds,
  recitersByIds,
} from '../hooks/homeReciters';
import {
  continueKey,
  resumableContinue,
  stableContinue,
} from '../hooks/homeContinue';
import {
  playOrOpen,
  surahTitle,
  voiceForSurah,
  type PlayItemInput,
} from '../services/playbackRouting';
import {shortReciterName} from '../services/listeningChoices';
import {getDefaultReciter} from '../services/tvDataService';
import {adhkarForList, adhkarList, ADHKAR_LISTS} from '../services/adhkarData';
import {useNavStore} from '../store/navStore';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {showToast} from '../store/toastStore';
import {
  JUZ_AMMA_SURAHS,
  SURAH_COLLECTIONS,
  type SurahCollection,
} from '../data/homeCollections';
import type {Reciter, Rewayah} from '../types/reciter';
import type {ContinueEntry} from '../services/continueListeningStore';
import type {LovedSurah} from '../services/lovedSurahsStore';
import type {Playlist} from '../services/playlistsStore';
import {surahGlow, TILE_HUES} from '../theme/surahColors';
import {colors} from '../theme/colors';
import {createScaledStyles, scale} from '../theme/scale';

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
  /** The surah the secondary plays, or null when it picks another reciter. */
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
      secondaryLabel: `${surahTitle(plan.insteadSurah)} instead`,
      primarySurah: null,
      listId: plan.listId,
      insteadSurah: plan.insteadSurah,
    };
  }
  return {
    kicker: plan.kicker,
    title: surahTitle(plan.surahNumber),
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

/** Juz 'Amma's rail shows its shortest surahs, then a tile for all of it. */
const JUZ_AMMA_TILES = JUZ_AMMA_SURAHS.slice(-12);

/** Loved surahs shown on Home; the Library has them all. */
const LOVED_TILES = 12;

/** How far above a focused rail's top Home scrolls, so its title shows. */
const RAIL_TOP_GAP = 36;

/**
 * Home: "Now playing" while the player holds a track, a hero that follows
 * the day (adhkar after Fajr and in the evening, Al-Kahf from the eve of
 * Friday, Al-Mulk at night, a surah of the day otherwise) with the clock,
 * then rails that show only when they have something: Continue listening,
 * the moment's rail, your reciters, playlists and loved surahs, adhkar,
 * collections, featured reciters and Juz 'Amma.
 */
export function HomeScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const liveContinue = useContinueListening();
  const favorites = useFavorites();
  const recent = useRecentlyPlayed();
  const loved = useLovedSurahs();
  const playlists = usePlaylists();
  const {defaultReciterId} = useDefaultReciter();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);
  const now = useClock();

  // ---- Plan: re-planned when the hour turns, but only while focus is in
  // the hero, so a rail never swaps out the card under the user.
  const [planHour, setPlanHour] = useState(() => planHourOf(now));
  const plan = useMemo(() => homePlanAt(new Date(planHour)), [planHour]);
  const heroFocused = useRef(true);
  const currentHour = planHourOf(now);
  useEffect(() => {
    if (heroFocused.current && currentHour !== planHour) {
      setPlanHour(currentHour);
    }
  }, [currentHour, planHour]);

  // ---- Focus: "Now playing" leads when the player holds a track; after
  // the reciter picker closes, focus returns to "Another reciter".
  const [nowPlayingFirst] = useState(() => {
    const {queue, currentIndex} = useTVPlayerStore.getState();
    return queue[currentIndex] !== undefined;
  });
  const [heroFocus, setHeroFocus] = useState<'primary' | 'secondary' | null>(
    nowPlayingFirst ? null : 'primary',
  );
  // The surah the reciter picker is for, frozen while it is open so an hour
  // turning (which can swap the hero) never pulls the panel away under focus.
  const [pickerSurah, setPickerSurah] = useState<number | null>(null);
  const pickerOpen = pickerSurah !== null;

  // ---- Scrolling: a focused rail scrolls up to sit under the screen's top
  // with its title showing; the hero scrolls back to the very top. This
  // also keeps the focused rail clear of the bottom overscan.
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const railY = useRef(new Map<HomeRow, number>());
  const scrollToY = useCallback((y: number): void => {
    const max = Math.max(0, contentH.current - viewportH.current);
    const target = Math.min(max, Math.max(0, y));
    if (Math.abs(target - offsetY.current) < 1) return;
    offsetY.current = target;
    scrollRef.current?.scrollTo({y: target, animated: true});
  }, []);
  // Whether focus is in Continue listening, whose order holds still only
  // then (see homeContinue).
  const [continueHeld, setContinueHeld] = useState(false);
  const onHeroFocus = useCallback((): void => {
    heroFocused.current = true;
    setContinueHeld(false);
    // Catch up with an hour that turned while focus was in the rails.
    setPlanHour(planHourOf(new Date()));
    scrollToY(0);
  }, [scrollToY]);
  const railFocus = useMemo(() => {
    const handlers = new Map<HomeRow, () => void>();
    return (row: HomeRow): (() => void) => {
      let handler = handlers.get(row);
      if (!handler) {
        handler = () => {
          heroFocused.current = false;
          setContinueHeld(row === 'continue');
          const y = railY.current.get(row);
          if (y !== undefined) scrollToY(y - scale(RAIL_TOP_GAP));
        };
        handlers.set(row, handler);
      }
      return handler;
    };
  }, [scrollToY]);
  const railLayout = useMemo(() => {
    const handlers = new Map<HomeRow, (e: LayoutChangeEvent) => void>();
    return (row: HomeRow): ((e: LayoutChangeEvent) => void) => {
      let handler = handlers.get(row);
      if (!handler) {
        handler = e => railY.current.set(row, e.nativeEvent.layout.y);
        handlers.set(row, handler);
      }
      return handler;
    };
  }, []);

  // ---- Data
  const reciterById = useMemo(
    () => new Map(reciters.map(r => [r.id, r])),
    [reciters],
  );
  const favoriteIds = useMemo(
    () => favorites.map(f => f.reciterId),
    [favorites],
  );
  const recentIds = useMemo(() => recent.map(e => e.reciterId), [recent]);

  // Home plays with the default reciter (or the app's pick until one is
  // set); a surah they don't have goes to a favourite or a well-known voice
  // who does, never to some other surah.
  const voiceCandidates = useMemo(
    () =>
      homeVoiceCandidates({
        reciters,
        first:
          (defaultReciterId ? reciterById.get(defaultReciterId) : undefined) ??
          getDefaultReciter(reciters),
        favoriteIds,
      }),
    [reciters, reciterById, defaultReciterId, favoriteIds],
  );
  const voiceFor = useCallback(
    (surahNumber: number): PlayItemInput | null =>
      voiceForSurah(voiceCandidates, surahNumber),
    [voiceCandidates],
  );

  const heroVoice = useMemo(
    () => (plan.hero.kind === 'surah' ? voiceFor(plan.hero.surahNumber) : null),
    [plan.hero, voiceFor],
  );
  const hero = useMemo(
    () =>
      heroView(
        plan.hero,
        heroVoice ? (reciterById.get(heroVoice.reciterId)?.name ?? null) : null,
      ),
    [plan.hero, heroVoice, reciterById],
  );

  // Continue listening holds its order while focus is in it, and is newest
  // first otherwise (see homeContinue).
  const continueOrder = useRef<string[]>([]);
  const continueEntries = useMemo(() => {
    const resumable = resumableContinue(liveContinue, id =>
      reciterById.has(id),
    );
    const out = stableContinue(continueOrder.current, resumable, continueHeld);
    continueOrder.current = out.keys;
    return out.entries;
  }, [liveContinue, reciterById, continueHeld]);

  const recentReciters = useMemo(
    () => recitersByIds(recentIds, reciters),
    [recentIds, reciters],
  );
  const favoriteReciters = useMemo(
    () => recitersByIds(favoriteIds, reciters),
    [favoriteIds, reciters],
  );
  const featuredReciters = useMemo(
    () => featuredRow(reciters, [...recentIds, ...favoriteIds]),
    [reciters, recentIds, favoriteIds],
  );
  const lovedSurahs = useMemo(
    () => loved.filter(e => reciterById.has(e.reciterId)),
    [loved, reciterById],
  );
  const adhkarIds = useMemo(
    () => adhkarRowIds(new Date(planHour), planListIds(plan)),
    [planHour, plan],
  );

  const rows = homeRows({
    continue: continueEntries.length,
    moments: plan.moments.items.length,
    recent: recentReciters.length,
    favorites: favoriteReciters.length,
    playlists: playlists.length,
    loved: lovedSurahs.length,
    adhkar: adhkarIds.length,
    collections: SURAH_COLLECTIONS.length,
    featured: featuredReciters.length,
    juzAmma: JUZ_AMMA_TILES.length,
  });

  // ---- Actions. playOrOpen opens the player at once and shows any failure
  // there; the track already playing just opens.
  const playSurah = useCallback(
    (surahNumber: number): void => {
      const voice = voiceFor(surahNumber);
      if (!voice) {
        showToast(`No reciter has ${surahTitle(surahNumber)} yet.`, 'error');
        return;
      }
      void playOrOpen({...voice, source: 'home'});
    },
    [voiceFor],
  );

  const playList = useCallback(
    (surahNumbers: readonly number[], source: string): void => {
      const queue = surahNumbers.flatMap(n => {
        const voice = voiceFor(n);
        return voice ? [voice] : [];
      });
      if (queue.length === 0) {
        showToast('No reciter has these surahs yet.', 'error');
        return;
      }
      void playOrOpen({...queue[0], queue, source});
    },
    [voiceFor],
  );

  const openSurahMenu = useCallback(
    (surahNumber: number): void => {
      const voice = voiceFor(surahNumber);
      useContextMenuStore.getState().openSurah({
        surahNumber,
        reciterId: voice?.reciterId,
        rewayahId: voice?.rewayahId,
        origin: 'home',
      });
    },
    [voiceFor],
  );

  const openAdhkar = useCallback(
    (listId: string): void => push({screen: 'adhkarReader', listId}),
    [push],
  );

  const handleContinue = useCallback((entry: ContinueEntry): void => {
    void playOrOpen({
      reciterId: entry.reciterId,
      rewayahId: entry.rewayahId || undefined,
      surahNumber: entry.surahNumber,
      startSeconds: entry.positionSeconds,
      source: 'home-continue',
    });
  }, []);

  const handleContinueMenu = useCallback((entry: ContinueEntry): void => {
    useContextMenuStore.getState().openSurah({
      surahNumber: entry.surahNumber,
      reciterId: entry.reciterId,
      rewayahId: entry.rewayahId || undefined,
      origin: 'continue',
    });
  }, []);

  // A loved surah plays in the voice it was loved in, with the rest of the
  // loved surahs after it. One surah can be loved in several voices, so a
  // tile stands for its entry (surah and reciter), never the surah alone.
  const lovedQueue = useMemo(
    () =>
      lovedSurahs.map(e => ({
        reciterId: e.reciterId,
        rewayahId: e.rewayahId || undefined,
        surahNumber: e.surahNumber,
      })),
    [lovedSurahs],
  );
  const handleLoved = useCallback(
    (entry: LovedSurah): void => {
      const item = lovedQueue.find(
        e =>
          e.surahNumber === entry.surahNumber &&
          e.reciterId === entry.reciterId,
      );
      if (!item) return;
      void playOrOpen({...item, queue: lovedQueue, source: 'home-loved'});
    },
    [lovedQueue],
  );
  const handleLovedMenu = useCallback((entry: LovedSurah): void => {
    useContextMenuStore.getState().openSurah({
      surahNumber: entry.surahNumber,
      reciterId: entry.reciterId,
      rewayahId: entry.rewayahId || undefined,
      origin: 'loved',
    });
  }, []);

  const openPlaylist = useCallback(
    (playlistId: string): void => push({screen: 'playlist', playlistId}),
    [push],
  );

  const handleReciter = useCallback(
    (reciter: Reciter): void =>
      push({screen: 'reciterDetail', reciterId: reciter.id}),
    [push],
  );

  function handlePrimary(): void {
    if (hero.listId) openAdhkar(hero.listId);
    else if (hero.primarySurah) playSurah(hero.primarySurah);
  }

  function handleSecondary(): void {
    if (hero.insteadSurah) {
      playSurah(hero.insteadSurah);
      return;
    }
    const surahNumber = hero.primarySurah;
    if (!surahNumber) return;
    // An empty panel would trap focus with nothing to press.
    if (!hasReciterChoice(reciters, surahNumber)) {
      showToast(`No reciter has ${surahTitle(surahNumber)} yet.`, 'error');
      return;
    }
    setHeroFocus(null);
    setPickerSurah(surahNumber);
  }

  const closePicker = useCallback((): void => {
    setPickerSurah(null);
    setHeroFocus('secondary');
  }, []);

  const pickReciter = useCallback(
    (reciter: Reciter, rewayah: Rewayah): void => {
      if (pickerSurah === null) return;
      setPickerSurah(null);
      void playOrOpen({
        reciterId: reciter.id,
        rewayahId: rewayah.id,
        surahNumber: pickerSurah,
        source: 'home-hero-reciter',
      });
    },
    [pickerSurah],
  );

  const pickerPreferred = useMemo(
    () =>
      preferredReciterIds({
        favoriteIds,
        defaultId: defaultReciterId,
        recentIds,
      }),
    [favoriteIds, defaultReciterId, recentIds],
  );

  // ---- Rails
  function renderMoment(item: MomentItem): React.ReactElement | null {
    if (item.kind === 'surah') {
      return (
        <SurahTile
          key={`s${item.surahNumber}`}
          surahNumber={item.surahNumber}
          surahName={surahTitle(item.surahNumber)}
          caption={surahCaption(item.surahNumber)}
          onSelect={playSurah}
          onLongPress={openSurahMenu}
          idPrefix="moment"
        />
      );
    }
    return renderAdhkar(item.listId);
  }

  function renderAdhkar(listId: string): React.ReactElement | null {
    const summary = adhkarSummary(listId);
    if (!summary) return null;
    return (
      <AdhkarTile
        key={`a${listId}`}
        listId={summary.listId}
        title={summary.title}
        arabicTitle={summary.arabicTitle}
        color={summary.color}
        meta={adhkarTileMeta(summary.count, summary.minutes)}
        onSelect={openAdhkar}
      />
    );
  }

  function renderPortraits(list: readonly Reciter[]): React.ReactNode {
    return list.map(r => (
      <ReciterPortrait key={r.id} reciter={r} onSelect={handleReciter} />
    ));
  }

  function rail(row: HomeRow, title: string, children: React.ReactNode) {
    return (
      <HomeRail
        key={row}
        title={title}
        onFocusRail={railFocus(row)}
        onLayout={railLayout(row)}>
        {children}
      </HomeRail>
    );
  }

  function renderRow(row: HomeRow): React.ReactNode {
    switch (row) {
      case 'continue':
        return rail(
          row,
          'Continue listening',
          continueEntries.map(e => (
            <ContinueWideCard
              key={continueKey(e)}
              entry={e}
              surahName={surahTitle(e.surahNumber)}
              reciterName={reciterById.get(e.reciterId)?.name ?? ''}
              onSelect={handleContinue}
              onLongPress={handleContinueMenu}
            />
          )),
        );
      case 'moments':
        return rail(
          row,
          plan.moments.title,
          plan.moments.items.map(renderMoment),
        );
      case 'recent':
        return rail(row, 'Recently played', renderPortraits(recentReciters));
      case 'favorites':
        return rail(
          row,
          'Your favourite reciters',
          renderPortraits(favoriteReciters),
        );
      case 'playlists':
        return rail(
          row,
          'Your playlists',
          playlists.map((p, i) => (
            <PlaylistTile
              key={p.id}
              playlist={p}
              color={p.color ?? TILE_HUES[i % TILE_HUES.length]}
              onSelect={openPlaylist}
            />
          )),
        );
      case 'loved':
        return rail(row, 'Loved surahs', [
          ...lovedSurahs
            .slice(0, LOVED_TILES)
            .map((e: LovedSurah) => (
              <LovedTile
                key={lovedKey(e)}
                entry={e}
                reciterName={reciterById.get(e.reciterId)?.name ?? ''}
                onSelect={handleLoved}
                onLongPress={handleLovedMenu}
              />
            )),
          ...(lovedSurahs.length > LOVED_TILES
            ? [
                <ColorTile
                  key="all-loved"
                  id="all-loved"
                  title="All loved surahs"
                  subtitle="In your Library"
                  caption={`${lovedSurahs.length} surahs`}
                  color={colors.surfaceElevated}
                  onSelect={() => switchTab('collection')}
                  accessibilityLabel="All loved surahs, in your Library"
                />,
              ]
            : []),
        ]);
      case 'adhkar':
        return rail(row, 'Adhkar', [
          ...adhkarIds.map(renderAdhkar),
          <ColorTile
            key="all-adhkar"
            id="all-adhkar"
            title="All adhkar"
            subtitle="From Hisn al-Muslim"
            caption={`${ADHKAR_LISTS.length} lists`}
            color={colors.surfaceElevated}
            onSelect={() => switchTab('adhkar')}
            accessibilityLabel="All adhkar"
          />,
        ]);
      case 'collections':
        return rail(
          row,
          'Collections',
          SURAH_COLLECTIONS.map(c => (
            <CollectionTile key={c.id} collection={c} onPlay={playList} />
          )),
        );
      case 'featured':
        return rail(
          row,
          'Featured reciters',
          renderPortraits(featuredReciters),
        );
      case 'juzAmma':
        return rail(row, "Juz 'Amma", [
          ...JUZ_AMMA_TILES.map(n => (
            <SurahTile
              key={n}
              surahNumber={n}
              surahName={surahTitle(n)}
              caption={surahCaption(n)}
              onSelect={playSurah}
              onLongPress={openSurahMenu}
              idPrefix="juz"
            />
          )),
          <ColorTile
            key="all-juz-amma"
            id="all-juz-amma"
            title="All of Juz 'Amma"
            subtitle="An-Naba to An-Nas"
            caption={surahListMeta(JUZ_AMMA_SURAHS)}
            color={TILE_HUES[1]}
            onSelect={() => playList(JUZ_AMMA_SURAHS, 'home-juz-amma')}
            accessibilityLabel={`Play all of Juz 'Amma, ${surahListMeta(JUZ_AMMA_SURAHS)}`}
          />,
        ]);
    }
  }

  return (
    <View style={styles.container}>
      <HomeGlow palette={hero.glow} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          offsetY.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={e => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, h) => {
          contentH.current = h;
        }}
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
          preferredFocus={heroFocus}
          onFocus={onHeroFocus}
          header={
            <NowPlayingStrip
              hasTVPreferredFocus={
                nowPlayingFirst && heroFocus === null && !pickerOpen
              }
              onFocus={onHeroFocus}
            />
          }
          corner={
            <HomeClock
              now={now}
              // "FRIDAY" in the hero already names the day.
              showDay={hero.kicker !== formatWeekday(now).toUpperCase()}
            />
          }
        />
        {rows.map(renderRow)}
      </ScrollView>
      {pickerSurah !== null ? (
        <HeroReciterPicker
          surahNumber={pickerSurah}
          reciters={reciters}
          currentId={heroVoice?.reciterId ?? null}
          preferredIds={pickerPreferred}
          onPick={pickReciter}
          onClose={closePicker}
        />
      ) : null}
    </View>
  );
}

/** A loved surah's tile, keyed by surah and reciter. */
function lovedKey(entry: {reciterId: string; surahNumber: number}): string {
  return `${entry.reciterId}:${entry.surahNumber}`;
}

/** A loved surah in the voice it was loved in; OK plays that recitation. */
const LovedTile = React.memo(function LovedTile({
  entry,
  reciterName,
  onSelect,
  onLongPress,
}: {
  entry: LovedSurah;
  reciterName: string;
  onSelect: (entry: LovedSurah) => void;
  onLongPress: (entry: LovedSurah) => void;
}): React.ReactElement {
  return (
    <SurahTile
      surahNumber={entry.surahNumber}
      surahName={surahTitle(entry.surahNumber)}
      caption={shortReciterName(reciterName)}
      onSelect={() => onSelect(entry)}
      onLongPress={() => onLongPress(entry)}
      idPrefix={`loved-${entry.reciterId}`}
    />
  );
});

/** A user playlist; OK opens it. */
const PlaylistTile = React.memo(function PlaylistTile({
  playlist,
  color,
  onSelect,
}: {
  playlist: Playlist;
  color: string;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const meta = surahListMeta(playlist.items.map(i => i.surahNumber));
  return (
    <ColorTile
      id={`playlist-${playlist.id}`}
      title={playlist.name}
      caption={meta}
      color={color}
      onSelect={() => onSelect(playlist.id)}
      accessibilityLabel={`Playlist ${playlist.name}, ${meta}`}
    />
  );
});

/** A curated collection; OK plays it from the top. */
const CollectionTile = React.memo(function CollectionTile({
  collection,
  onPlay,
}: {
  collection: SurahCollection;
  onPlay: (surahs: readonly number[], source: string) => void;
}): React.ReactElement {
  const meta = surahListMeta(collection.surahs);
  return (
    <ColorTile
      id={`collection-${collection.id}`}
      title={collection.title}
      subtitle={collection.description}
      caption={meta}
      color={collection.color}
      onSelect={() => onPlay(collection.surahs, 'home-collection')}
      accessibilityLabel={`Play ${collection.title}, ${meta}`}
    />
  );
});

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {
    paddingHorizontal: HOME_GUTTER,
    paddingTop: 40,
    // Room for the last rail to scroll up under the top (see scrollToY).
    paddingBottom: 220,
  },
});
