import React, {useCallback, useMemo, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FilterChip} from '../components/browse/FilterChip';
import {BROWSE_GUTTER} from '../components/browse/gridLayout';
import {ReciterGrid} from '../components/catalog/ReciterGrid';
import {useReciters} from '../hooks/useReciters';
import {
  REWAYAH_CHIPS,
  STYLE_CHIPS,
  availableChips,
  featuredFirst,
  matchesChips,
  type RewayahChip,
  type StyleChip,
} from '../services/browseCatalog';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {fonts, typography} from '../theme/typography';
import type {Reciter} from '../types/reciter';
import {createScaledStyles} from '../theme/scale';

/**
 * Reciters: one grid of round portraits, featured reciters first, filtered
 * by a rewayah chip (single choice) and an optional style chip (pressing the
 * selected style again clears it). Chips the catalog can't fill are hidden.
 */
export function CatalogGridScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const [rewayah, setRewayah] = useState<RewayahChip>('all');
  const [style, setStyle] = useState<StyleChip | null>(null);
  // The first portrait takes focus on entry, not after a chip press.
  const [focusFirst, setFocusFirst] = useState<boolean>(true);

  const ordered = useMemo(() => featuredFirst(reciters), [reciters]);
  const available = useMemo(() => availableChips(reciters), [reciters]);
  const visible = useMemo(
    () => ordered.filter(r => matchesChips(r, rewayah, style)),
    [ordered, rewayah, style],
  );

  const rewayahChips = REWAYAH_CHIPS.filter(c => available.rewayah.has(c.key));
  // A lone style chip would filter nothing out: show styles only when the
  // catalog has more than one.
  const styleChips =
    available.style.size > 1
      ? STYLE_CHIPS.filter(c => available.style.has(c.key))
      : [];

  const handleSelect = useCallback(
    (reciter: Reciter): void => {
      push({screen: 'reciterDetail', reciterId: reciter.id});
    },
    [push],
  );

  function chooseRewayah(next: RewayahChip): void {
    setFocusFirst(false);
    setRewayah(next);
  }

  function toggleStyle(next: StyleChip): void {
    setFocusFirst(false);
    setStyle(prev => (prev === next ? null : next));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reciters</Text>
      </View>
      <TVFocusGuideView autoFocus style={styles.chipRow}>
        {rewayahChips.map(c => (
          <FilterChip
            key={c.key}
            label={c.label}
            selected={rewayah === c.key}
            onPress={() => chooseRewayah(c.key)}
          />
        ))}
        {styleChips.length > 0 ? <View style={styles.chipDivider} /> : null}
        {styleChips.map(c => (
          <FilterChip
            key={c.key}
            label={c.label}
            selected={style === c.key}
            onPress={() => toggleStyle(c.key)}
          />
        ))}
      </TVFocusGuideView>
      <TVFocusGuideView autoFocus style={styles.gridWrap}>
        <ReciterGrid
          key={`${rewayah}-${style ?? 'any'}`}
          reciters={visible}
          onSelect={handleSelect}
          focusFirst={focusFirst}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No reciters match these filters yet.
            </Text>
          }
        />
      </TVFocusGuideView>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingHorizontal: BROWSE_GUTTER,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: {color: colors.text, ...typography.title, letterSpacing: -0.5},
  // Chips carry 18 px of side padding: pull the row out so their text lines
  // up with the title and the portraits.
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: BROWSE_GUTTER - 18,
    paddingBottom: spacing.xs,
  },
  chipDivider: {
    width: 1,
    height: 28,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.border,
  },
  gridWrap: {flex: 1},
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: 13,
    paddingTop: spacing.md,
  },
});
