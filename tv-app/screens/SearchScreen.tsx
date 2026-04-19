import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {Rail} from '../components/rails/Rail';
import {ReciterCard} from '../components/rails/ReciterCard';
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
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search reciters"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        {filtered.length > 0 ? (
          <Rail title={`Reciters · ${filtered.length}`}>
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
          <Text style={styles.hint}>
            {query ? 'No matches' : 'Type to search reciters'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  body: {padding: spacing.xl, gap: spacing.lg},
  input: {
    color: colors.text,
    fontSize: 28,
    borderBottomWidth: 2,
    borderColor: colors.textSecondary,
    paddingVertical: 8,
  },
  hint: {color: colors.textSecondary, ...typography.body},
});
