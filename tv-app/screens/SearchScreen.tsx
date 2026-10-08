import React, {useState} from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TVFocusGuideView,
  View,
} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {QuickPlayCard} from '../components/rails/QuickPlayCard';
import {SearchIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useDefaultReciter} from '../hooks/useDefaultReciter';
import {useSearchRecents} from '../hooks/useSearchRecents';
import {useSearch, MIN_QUERY_LENGTH} from '../hooks/useSearch';
import {usePlayer} from '../hooks/usePlayer';
import {useNavStore} from '../store/navStore';
import {
  clearRecentSearches,
  recordSearch,
  removeRecentSearch,
} from '../services/searchRecentsStore';
import {fetchRewayat} from '../services/tvDataService';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

export function SearchScreen(): React.ReactElement {
  const [query, setQuery] = useState('');
  const {reciters} = useReciters();
  const {defaultReciterId} = useDefaultReciter();
  const recents = useSearchRecents();
  const {playRewayah} = usePlayer();
  const push = useNavStore(s => s.push);

  const {
    reciters: reciterResults,
    surahs: surahResults,
    loading,
  } = useSearch(query, reciters);

  const active = query.trim().length >= MIN_QUERY_LENGTH;

  function commitSearch(): void {
    recordSearch(query);
  }

  function handleReciterSelect(reciterId: string): void {
    commitSearch();
    push({screen: 'reciterDetail', reciterId});
  }

  async function handleSurahSelect(surahNumber: number): Promise<void> {
    if (!defaultReciterId) return;
    const reciter = reciters.find(r => r.id === defaultReciterId);
    if (!reciter) return;
    const rewayat = await fetchRewayat(defaultReciterId);
    const rewayah = rewayat[0];
    if (!rewayah) return;
    commitSearch();
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
        <TVFocusGuideView autoFocus style={styles.inputRow}>
          <SearchIcon color={colors.text} size={scale(32)} />
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
        </TVFocusGuideView>
        <TVFocusGuideView autoFocus style={styles.results}>
          <ScrollView
            style={styles.results}
            showsVerticalScrollIndicator={false}>
            {hasReciters && (
              <Rail
                title={`${reciterResults.length} ${
                  reciterResults.length === 1 ? 'reciter' : 'reciters'
                }`}>
                {reciterResults.map(r => (
                  <ReciterCard
                    key={r.id}
                    reciter={r}
                    onSelect={() => handleReciterSelect(r.id)}
                  />
                ))}
              </Rail>
            )}

            {hasSurahs && defaultReciterId && (
              <Rail
                title={`${surahResults.length} ${
                  surahResults.length === 1 ? 'surah' : 'surahs'
                } to play`}>
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

            {!active && recents.length > 0 && (
              <View style={styles.recentsBlock}>
                <View style={styles.recentsHeader}>
                  <Text style={styles.recentsKicker}>RECENT SEARCHES</Text>
                  <FocusableButton
                    onPress={() => clearRecentSearches()}
                    accessibilityLabel="Clear recent searches"
                    style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </FocusableButton>
                </View>
                <View style={styles.recentList}>
                  {recents.map(r => (
                    <View key={r} style={styles.recentRow}>
                      <FocusableButton
                        onPress={() => setQuery(r)}
                        accessibilityLabel={`Search ${r}`}
                        focusedStyle={styles.recentFillWrap}
                        style={styles.recentFill}>
                        <Text style={styles.recentFillText} numberOfLines={1}>
                          {r}
                        </Text>
                      </FocusableButton>
                      <FocusableButton
                        onPress={() => removeRecentSearch(r)}
                        accessibilityLabel={`Remove ${r} from recent searches`}
                        style={styles.recentRemove}>
                        <Text style={styles.recentRemoveText}>Remove</Text>
                      </FocusableButton>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {active && loading && !hasAny && (
              <View style={styles.emptyWrap}>
                <Text style={styles.hint}>Searching…</Text>
              </View>
            )}

            {active && !loading && !hasAny && (
              <View style={styles.emptyWrap}>
                <Text style={styles.hint}>No matches for that search</Text>
              </View>
            )}

            {!active && recents.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.hint}>
                  Start typing a reciter, a surah name, or a surah number
                </Text>
              </View>
            )}
          </ScrollView>
        </TVFocusGuideView>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: 6,
  },
  kicker: {
    color: colors.text,
    ...typography.label,
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
    fontFamily: fonts.medium,
    fontSize: 34,
    fontWeight: '500',
    paddingVertical: 6,
    letterSpacing: -0.5,
  },
  results: {flex: 1},
  emptyWrap: {paddingTop: spacing.xl, alignItems: 'center'},
  hint: {color: colors.textSecondary, ...typography.body, opacity: 0.7},
  recentsBlock: {paddingTop: spacing.sm, paddingBottom: spacing.md},
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentsKicker: {
    color: colors.text,
    ...typography.label,
    opacity: 0.55,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clearBtnText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recentList: {gap: 10},
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentFillWrap: {flex: 1},
  recentFill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recentFillText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  recentRemove: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recentRemoveText: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
