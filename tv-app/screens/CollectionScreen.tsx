import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {ReciterCard} from '../components/rails/ReciterCard';
import {HeartIcon} from '../../components/Icons';
import {useReciters} from '../hooks/useReciters';
import {useFavorites} from '../hooks/useFavorites';
import {useNavStore} from '../store/navStore';
import type {Reciter} from '../types/reciter';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function CollectionScreen(): React.ReactElement {
  const favorites = useFavorites();
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);

  const byId = new Map<string, Reciter>();
  reciters.forEach(r => byId.set(r.id, r));

  const favoriteReciters = favorites
    .map(f => byId.get(f.reciterId))
    .filter((r): r is Reciter => !!r);

  const hasFavorites = favoriteReciters.length > 0;

  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR LIBRARY</Text>
        <Text style={styles.pageTitle}>Collection</Text>
        {hasFavorites ? (
          <Text style={styles.sub}>
            {favoriteReciters.length}{' '}
            {favoriteReciters.length === 1 ? 'reciter' : 'reciters'} favorited
          </Text>
        ) : null}
      </View>
      {hasFavorites ? (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}>
          {favoriteReciters.map((r, i) => (
            <View key={r.id} style={styles.cell}>
              <ReciterCard
                reciter={r}
                onSelect={() =>
                  push({screen: 'reciterDetail', reciterId: r.id})
                }
                hasTVPreferredFocus={i === 0}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <View style={styles.iconHalo}>
            <HeartIcon color={colors.text} size={64} />
          </View>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptySub}>
            Open a reciter and tap Favorite to pin them here.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: 6},
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
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl - 8,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cell: {padding: 10},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptySub: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 28,
    opacity: 0.75,
  },
});
