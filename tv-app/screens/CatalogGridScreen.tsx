import {FlashList} from '@shopify/flash-list';
import React, {useMemo} from 'react';
import {
  StyleSheet,
  Text,
  TVFocusGuideView,
  useWindowDimensions,
  View,
} from 'react-native';
import {TopTabBar} from '../components/nav/TopTabBar';
import {Rail} from '../components/rails/Rail';
import {RailHeader} from '../components/rails/RailHeader';
import {ReciterCard} from '../components/rails/ReciterCard';
import {useReciters} from '../hooks/useReciters';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import type {Reciter} from '../types/reciter';

const CELL_HEIGHT = 300;
const MAX_PER_ROW = 16;
const ROW_MIN = 5;
const MAINSTREAM_REWAYAH = /hafs|warsh|qalon|qalun/i;

type Category = {
  key: string;
  title: string;
  reciters: Reciter[];
};

function hasRewayahMatching(reciter: Reciter, pattern: RegExp): boolean {
  return reciter.rewayat?.some(rewayah => pattern.test(rewayah.name)) ?? false;
}

function hasRareRewayah(reciter: Reciter): boolean {
  return (
    reciter.rewayat?.some(rewayah => !MAINSTREAM_REWAYAH.test(rewayah.name)) ??
    false
  );
}

function buildCategories(reciters: Reciter[]): Category[] {
  const definitions: ReadonlyArray<{
    key: string;
    title: string;
    min: number;
    match: (reciter: Reciter) => boolean;
  }> = [
    {
      key: 'featured',
      title: 'Featured Reciters',
      min: 1,
      match: reciter => reciter.is_featured,
    },
    {
      key: 'multi',
      title: 'Multiple Rewayat',
      min: ROW_MIN,
      match: reciter => (reciter.rewayat?.length ?? 0) > 1,
    },
    {
      key: 'warsh',
      title: "Warsh A'n Nafi'",
      min: ROW_MIN,
      match: reciter => hasRewayahMatching(reciter, /warsh/i),
    },
    {
      key: 'qalun',
      title: "Qalun A'n Nafi'",
      min: ROW_MIN,
      match: reciter => hasRewayahMatching(reciter, /qalon|qalun/i),
    },
    {
      key: 'other',
      title: "Other Qira'at",
      min: ROW_MIN,
      match: hasRareRewayah,
    },
  ];

  const categories: Category[] = [];
  for (const def of definitions) {
    const matched = reciters.filter(def.match).slice(0, MAX_PER_ROW);
    if (matched.length >= def.min) {
      categories.push({key: def.key, title: def.title, reciters: matched});
    }
  }
  return categories;
}

function overrideItemLayout(layout: {span?: number; size?: number}): void {
  layout.span = 1;
  layout.size = CELL_HEIGHT;
}

type HeaderProps = {
  count: number;
  categories: Category[];
  onSelect: (reciter: Reciter) => void;
};

function CatalogHeader({
  count,
  categories,
  onSelect,
}: HeaderProps): React.ReactElement {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.kicker}>BROWSE</Text>
        <Text style={styles.title}>All Reciters</Text>
        <Text style={styles.sub}>
          {count} voices, from cornerstones to contemporary masters
        </Text>
      </View>
      {categories.map((category, categoryIndex) => (
        <Rail key={category.key} title={category.title}>
          {category.reciters.map((reciter, reciterIndex) => (
            <ReciterCard
              key={reciter.id}
              reciter={reciter}
              onSelect={onSelect}
              hasTVPreferredFocus={categoryIndex === 0 && reciterIndex === 0}
            />
          ))}
        </Rail>
      ))}
      <View style={styles.gridLabel}>
        <RailHeader title="All Reciters" />
      </View>
    </View>
  );
}

export function CatalogGridScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const {width} = useWindowDimensions();
  const numColumns = width >= 1800 ? 6 : width >= 1400 ? 5 : 4;

  const categories = useMemo(() => buildCategories(reciters), [reciters]);
  const hasCategoryRows = categories.length > 0;

  function handleSelect(reciter: Reciter): void {
    push({screen: 'reciterDetail', reciterId: reciter.id});
  }

  return (
    <View style={styles.container}>
      <TopTabBar />
      <TVFocusGuideView autoFocus style={styles.listWrap}>
        <FlashList
          data={reciters}
          numColumns={numColumns}
          overrideItemLayout={overrideItemLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <CatalogHeader
              count={reciters.length}
              categories={categories}
              onSelect={handleSelect}
            />
          }
          renderItem={({item, index}) => (
            <View style={styles.cell}>
              <ReciterCard
                reciter={item}
                onSelect={handleSelect}
                hasTVPreferredFocus={!hasCategoryRows && index === 0}
              />
            </View>
          )}
          keyExtractor={reciter => reciter.id}
        />
      </TVFocusGuideView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  listWrap: {flex: 1, paddingHorizontal: spacing.xl - 8},
  listContent: {paddingBottom: spacing.xxl},
  header: {
    paddingHorizontal: 8,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
  },
  kicker: {color: colors.text, ...typography.label, opacity: 0.55},
  title: {color: colors.text, ...typography.title, letterSpacing: -0.5},
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 20,
    fontWeight: '400',
    opacity: 0.75,
    marginTop: 2,
  },
  gridLabel: {paddingHorizontal: 8, paddingTop: spacing.sm},
  cell: {padding: 12},
});
