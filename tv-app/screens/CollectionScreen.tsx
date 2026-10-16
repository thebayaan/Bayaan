import React, {useMemo} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {
  ContinueWideCard,
  FavoriteSurahCard,
} from '../components/library/LibraryCards';
import {useReciters} from '../hooks/useReciters';
import {useFavorites} from '../hooks/useFavorites';
import {useContinueListening} from '../hooks/useContinueListening';
import {useRecentlyPlayed} from '../hooks/useRecentlyPlayed';
import {useLovedSurahs} from '../hooks/useLovedSurahs';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {fetchRewayat} from '../services/tvDataService';
import {rewayahForSurah} from '../services/listeningChoices';
import type {ContinueEntry} from '../services/continueListeningStore';
import type {LovedSurah} from '../services/lovedSurahsStore';
import type {Reciter} from '../types/reciter';
import SURAHS from '../../data/surahData.json';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

type SurahMeta = {id: number; name: string};

const surahNames = new Map<number, string>(
  (SURAHS as SurahMeta[]).map(s => [s.id, s.name]),
);

function surahName(n: number): string {
  return surahNames.get(n) ?? `Surah ${n}`;
}

/**
 * The Library: what you are in the middle of, the surahs and reciters you
 * keep, and who you played lately, as rows you can return to in one press.
 * Each row explains how to fill it while it is empty.
 */
export function CollectionScreen(): React.ReactElement {
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const recent = useRecentlyPlayed();
  const loved = useLovedSurahs();
  const {reciters} = useReciters();
  const {playRewayah, resumeContinue} = usePlayer();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

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

  const inProgress = useMemo(
    () => continueEntries.filter(e => reciterById.has(e.reciterId)),
    [continueEntries, reciterById],
  );

  async function resume(entry: ContinueEntry): Promise<void> {
    const reciter = reciterById.get(entry.reciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(entry.reciterId);
    const rewayah = rewayat.find(r => r.id === entry.rewayahId) ?? rewayat[0];
    if (!rewayah) return;
    push({screen: 'nowPlaying'});
    await resumeContinue(
      reciter.id,
      reciter.name,
      rewayah,
      entry.surahNumber,
      entry.positionSeconds,
    );
  }

  async function playLoved(entry: LovedSurah): Promise<void> {
    const reciter = reciterById.get(entry.reciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(reciter.id);
    const rewayah =
      rewayat.find(
        r =>
          r.id === entry.rewayahId && r.surah_list.includes(entry.surahNumber),
      ) ?? rewayahForSurah({...reciter, rewayat}, entry.surahNumber);
    if (!rewayah) return;
    push({screen: 'nowPlaying'});
    await playRewayah(reciter.id, reciter.name, rewayah, entry.surahNumber);
  }

  const openReciter = (r: Reciter) =>
    push({screen: 'reciterDetail', reciterId: r.id});

  const empty =
    inProgress.length === 0 &&
    loved.length === 0 &&
    favoriteReciters.length === 0 &&
    recentReciters.length === 0;

  if (empty) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Library</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your listening lives here</Text>
          <Text style={styles.emptySub}>
            Surahs you start, the surahs and reciters you favorite, and the
            voices you play will gather on this page so you can return to them
            in one press.
          </Text>
          <FocusableButton
            onPress={() => switchTab('reciters')}
            accessibilityLabel="Browse reciters"
            hasTVPreferredFocus
            outlined
            style={styles.emptyCta}>
            <FocusText style={styles.emptyCtaText}>Browse reciters</FocusText>
          </FocusableButton>
        </View>
      </View>
    );
  }

  // The first row with something in it takes focus when the page opens.
  const firstRow =
    inProgress.length > 0
      ? 'continue'
      : loved.length > 0
        ? 'surahs'
        : favoriteReciters.length > 0
          ? 'reciters'
          : 'recent';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Library</Text>
        </View>

        <View style={styles.rails}>
          {inProgress.length > 0 ? (
            <Rail title="Continue listening">
              {inProgress.map((e, i) => (
                <ContinueWideCard
                  key={`${e.reciterId}:${e.surahNumber}`}
                  entry={e}
                  surahName={surahName(e.surahNumber)}
                  reciterName={reciterById.get(e.reciterId)?.name ?? ''}
                  onSelect={resume}
                  hasTVPreferredFocus={firstRow === 'continue' && i === 0}
                />
              ))}
            </Rail>
          ) : (
            <EmptyRow
              title="Continue listening"
              text="Start any surah and it waits here with the time left, so you can pick up where you stopped."
            />
          )}

          {loved.length > 0 ? (
            <Rail title="Favorite surahs">
              {loved.map((e, i) => (
                <FavoriteSurahCard
                  key={e.surahNumber}
                  loved={e}
                  surahName={surahName(e.surahNumber)}
                  reciterName={reciterById.get(e.reciterId)?.name ?? ''}
                  onSelect={playLoved}
                  hasTVPreferredFocus={firstRow === 'surahs' && i === 0}
                />
              ))}
            </Rail>
          ) : (
            <EmptyRow
              title="Favorite surahs"
              text="While a surah plays, press OK and choose the heart to keep it here in that voice."
            />
          )}

          {favoriteReciters.length > 0 ? (
            <Rail title="Favorite reciters">
              {favoriteReciters.map((r, i) => (
                <ReciterCard
                  key={r.id}
                  reciter={r}
                  onSelect={openReciter}
                  hasTVPreferredFocus={firstRow === 'reciters' && i === 0}
                />
              ))}
            </Rail>
          ) : (
            <EmptyRow
              title="Favorite reciters"
              text="Open a reciter and choose Favorite to keep them here."
            />
          )}

          {recentReciters.length > 0 ? (
            <Rail title="Recently played">
              {recentReciters.map((r, i) => (
                <ReciterCard
                  key={r.id}
                  reciter={r}
                  onSelect={openReciter}
                  hasTVPreferredFocus={firstRow === 'recent' && i === 0}
                />
              ))}
            </Rail>
          ) : (
            <EmptyRow
              title="Recently played"
              text="The reciters you listen to show up here, newest first."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyRow({
  title,
  text,
}: {
  title: string;
  text: string;
}): React.ReactElement {
  return (
    <View style={styles.hint}>
      <Text style={styles.hintTitle}>{title}</Text>
      <Text style={styles.hintText}>{text}</Text>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {paddingBottom: spacing.xxl},
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
  },
  rails: {paddingLeft: spacing.xl - 16},
  hint: {
    paddingLeft: 16,
    marginBottom: spacing.lg,
    gap: 8,
    maxWidth: 1000,
  },
  hintTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 8,
  },
  hintText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 26,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  emptySub: {
    color: colors.textSecondary,
    ...typography.body,
    maxWidth: 760,
    lineHeight: 32,
  },
  emptyCta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyCtaText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
  },
});
