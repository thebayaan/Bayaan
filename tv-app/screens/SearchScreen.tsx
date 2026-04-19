import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {QuickPlayCard} from '../components/rails/QuickPlayCard';
import {SearchIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {fetchRewayat} from '../services/tvDataService';
import {SURAHS} from '../../data/surahData';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

type SurahMeta = {id: number; name: string};

export function SearchScreen(): React.ReactElement {
  const [query, setQuery] = useState('');
  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);

  const q = query.trim().toLowerCase();
  const ready = q.length >= 2;

  const reciterResults = useMemo(() => {
    if (!ready) return [];
    return reciters.filter(r => r.name.toLowerCase().includes(q)).slice(0, 20);
  }, [reciters, q, ready]);

  const surahResults = useMemo(() => {
    if (!ready) return [];
    const numericQ = Number(q);
    return (SURAHS as SurahMeta[])
      .filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          (Number.isFinite(numericQ) && s.id === numericQ),
      )
      .slice(0, 12);
  }, [q, ready]);

  async function handleSurahSelect(surahNumber: number): Promise<void> {
    if (!defaultReciterId) return;
    const reciter = reciters.find(r => r.id === defaultReciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(defaultReciterId);
    const rewayah = rewayat[0];
    if (!rewayah) return;
    await playRewayah(reciter.id, reciter.name, rewayah, surahNumber);
    push({screen: 'nowPlaying'});
  }

  const hasReciters = reciterResults.length > 0;
  const hasSurahs = surahResults.length > 0;
  const hasAny = hasReciters || hasSurahs;

  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.body}>
        <Text style={styles.kicker}>CATALOG</Text>
        <Text style={styles.pageTitle}>Search</Text>
        <View style={styles.inputRow}>
          <SearchIcon color={colors.text} size={32} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Reciter name, surah name, or number"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            hasTVPreferredFocus
          />
        </View>
        <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
          {hasReciters && (
            <Rail
              title={`${reciterResults.length} ${
                reciterResults.length === 1 ? 'reciter' : 'reciters'
              }`}>
              {reciterResults.map(r => (
                <ReciterCard
                  key={r.id}
                  reciter={r}
                  onSelect={() =>
                    push({screen: 'reciterDetail', reciterId: r.id})
                  }
                />
              ))}
            </Rail>
          )}

          {hasSurahs && defaultReciterId && (
            <Rail
              title={`${surahResults.length} ${
                surahResults.length === 1 ? 'surah' : 'surahs'
              } — tap to play`}>
              {surahResults.map(s => (
                <QuickPlayCard
                  key={s.id}
                  surahNumber={s.id}
                  surahName={s.name}
                  onSelect={handleSurahSelect}
                />
              ))}
            </Rail>
          )}

          {!hasAny && (
            <View style={styles.emptyWrap}>
              <Text style={styles.hint}>
                {ready
                  ? 'No matches for that search'
                  : 'Start typing — reciters, surah names, or surah numbers'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: 6,
  },
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
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 32,
    fontWeight: '500',
    paddingVertical: 6,
    letterSpacing: -0.5,
  },
  results: {flex: 1},
  emptyWrap: {paddingTop: spacing.xxl, alignItems: 'center'},
  hint: {color: colors.textSecondary, ...typography.body, opacity: 0.7},
});
