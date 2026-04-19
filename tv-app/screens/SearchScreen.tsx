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
        <View style={styles.inputRow}>
          <SearchIcon color={colors.textSecondary} size={28} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search reciters"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
        </View>
        {filtered.length > 0 ? (
          <Rail title={`${filtered.length} reciters`}>
            {filtered.map((r, i) => (
              <ReciterCard
                key={r.id}
                reciter={r}
                onSelect={() =>
                  push({screen: 'reciterDetail', reciterId: r.id})
                }
                hasTVPreferredFocus={i === 0}
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
  body: {padding: spacing.xl, gap: spacing.lg},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 2,
    borderColor: colors.surface,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 32,
    fontWeight: '500',
    paddingVertical: 6,
  },
  emptyWrap: {paddingTop: spacing.xxl, alignItems: 'center'},
  hint: {color: colors.textSecondary, ...typography.body, opacity: 0.7},
});
