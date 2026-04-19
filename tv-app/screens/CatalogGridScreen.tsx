import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {ReciterGrid} from '../components/catalog/ReciterGrid';
import {useReciters} from '../hooks/useReciters';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {typography} from '../theme/typography';

export function CatalogGridScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  return (
    <View style={styles.container}>
      <TopTabBar />
      <View style={styles.header}>
        <Text style={styles.kicker}>BROWSE</Text>
        <Text style={styles.title}>All Reciters</Text>
        <Text style={styles.sub}>
          {reciters.length} voices, from cornerstones to contemporary masters
        </Text>
      </View>
      <View style={styles.gridWrap}>
        <ReciterGrid
          reciters={reciters}
          onSelect={r => push({screen: 'reciterDetail', reciterId: r.id})}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
  },
  kicker: {color: colors.text, ...typography.label, opacity: 0.55},
  title: {color: colors.text, ...typography.title, letterSpacing: -0.5},
  sub: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '400',
    opacity: 0.75,
    marginTop: 2,
  },
  gridWrap: {flex: 1, paddingHorizontal: spacing.xl - 8},
});
