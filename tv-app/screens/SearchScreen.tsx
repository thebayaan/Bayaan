import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
import {SearchIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function SearchScreen(): React.ReactElement {
  const [query, setQuery] = useState('');
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return reciters.filter(r => r.name.toLowerCase().includes(q)).slice(0, 20);
  }, [reciters, query]);

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
            placeholder="Search reciters"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            hasTVPreferredFocus
          />
        </View>
        {filtered.length > 0 ? (
          <Rail
            title={`${filtered.length} ${
              filtered.length === 1 ? 'reciter' : 'reciters'
            }`}>
            {filtered.map(r => (
              <ReciterCard
                key={r.id}
                reciter={r}
                onSelect={() =>
                  push({screen: 'reciterDetail', reciterId: r.id})
                }
              />
            ))}
          </Rail>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.hint}>
              {query
                ? 'No reciters match that search'
                : 'Start typing to find a reciter'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: 6},
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
    fontSize: 36,
    fontWeight: '500',
    paddingVertical: 6,
    letterSpacing: -0.5,
  },
  emptyWrap: {paddingTop: spacing.xxl, alignItems: 'center'},
  hint: {color: colors.textSecondary, ...typography.body, opacity: 0.7},
});
