import React, {useMemo} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {
  ResumeHero,
  SurahProgressCard,
} from '../components/library/LibraryCards';
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
import {fonts, typography} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';

type SurahMeta = {id: number; name: string};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The Library: one page, no tabs. The surah you were last listening to leads,
 * large, with the rest of your unfinished surahs under it, then the reciters
 * you saved and the ones you played recently.
 */
export function CollectionScreen(): React.ReactElement {
  const favorites = useFavorites();
  const continueEntries = useContinueListening();
  const recent = useRecentlyPlayed();
  const {reciters} = useReciters();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);
  const switchTab = useNavStore(s => s.switchTab);

  const reciterById = useMemo(() => {
    const map = new Map<string, Reciter>();
    reciters.forEach(r => map.set(r.id, r));
    return map;
  }, [reciters]);

  const surahName = (n: number): string =>
    (SURAHS as SurahMeta[]).find(s => s.id === n)?.name ?? `Surah ${n}`;

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
    await playRewayah(reciter.id, reciter.name, rewayah, entry.surahNumber);
    push({screen: 'nowPlaying'});
  }

  const openReciter = (r: Reciter) =>
    push({screen: 'reciterDetail', reciterId: r.id});

  const empty =
    inProgress.length === 0 &&
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
            Surahs you start, reciters you favorite and the ones you play will
            gather on this page so you can return to them in one press.
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

  const [lead, ...rest] = inProgress;
  const summary = [
    inProgress.length > 0 &&
      plural(inProgress.length, 'surah in progress', 'surahs in progress'),
    favoriteReciters.length > 0 &&
      plural(favoriteReciters.length, 'favorite', 'favorites'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Library</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>

        {lead ? (
          <TVFocusGuideView autoFocus style={styles.heroWrap}>
            <ResumeHero
              entry={lead}
              surahName={surahName(lead.surahNumber)}
              reciterName={reciterById.get(lead.reciterId)?.name ?? ''}
              onSelect={resume}
              hasTVPreferredFocus
            />
          </TVFocusGuideView>
        ) : null}

        <View style={styles.rails}>
          {rest.length > 0 ? (
            <Rail title="Also in progress">
              {rest.map(e => (
                <SurahProgressCard
                  key={`${e.reciterId}:${e.surahNumber}`}
                  entry={e}
                  surahName={surahName(e.surahNumber)}
                  reciterName={reciterById.get(e.reciterId)?.name ?? ''}
                  onSelect={resume}
                />
              ))}
            </Rail>
          ) : null}

          {favoriteReciters.length > 0 ? (
            <Rail title="Your reciters">
              {favoriteReciters.map((r, i) => (
                <ReciterCard
                  key={r.id}
                  reciter={r}
                  onSelect={openReciter}
                  hasTVPreferredFocus={!lead && i === 0}
                />
              ))}
            </Rail>
          ) : (
            <View style={styles.hint}>
              <Text style={styles.hintTitle}>Your reciters</Text>
              <Text style={styles.hintText}>
                Open a reciter and choose Favorite to keep them here.
              </Text>
            </View>
          )}

          {recentReciters.length > 0 ? (
            <Rail title="Recently played">
              {recentReciters.map((r, i) => (
                <ReciterCard
                  key={r.id}
                  reciter={r}
                  onSelect={openReciter}
                  hasTVPreferredFocus={
                    !lead && favoriteReciters.length === 0 && i === 0
                  }
                />
              ))}
            </Rail>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {paddingBottom: spacing.xxl},
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: 8,
    marginBottom: spacing.md,
  },
  pageTitle: {
    color: colors.text,
    ...typography.title,
    letterSpacing: -0.5,
  },
  summary: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  // Inset so the hero's focus ring has room on every side.
  heroWrap: {
    paddingHorizontal: spacing.xl - 10,
    paddingVertical: 10,
    marginBottom: spacing.lg,
  },
  rails: {paddingLeft: spacing.xl - 16},
  hint: {paddingLeft: 16, marginBottom: spacing.lg, gap: 8},
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
