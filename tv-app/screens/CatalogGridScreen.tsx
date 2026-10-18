import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Text, TVFocusGuideView, View} from 'react-native';
import {FilterChip} from '../components/browse/FilterChip';
import {BROWSE_GUTTER} from '../components/browse/gridLayout';
import {ReciterGrid} from '../components/catalog/ReciterGrid';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
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
 * by a rewayah chip and a style chip ("Any style" or one style), both single
 * choice. Only chips that leave someone in the grid are shown: styles are
 * the ones recorded in the chosen rewayah, so no pair of chips can empty it.
 */
export function CatalogGridScreen(): React.ReactElement {
  const {reciters} = useReciters();
  const push = useNavStore(s => s.push);
  const [rewayah, setRewayah] = useState<RewayahChip>('all');
  const [chosenStyle, setStyle] = useState<StyleChip | null>(null);
  // The first portrait takes focus on entry, not after a chip press.
  const [focusFirst, setFocusFirst] = useState<boolean>(true);
  // Drop the request once the grid has had time to take it: FlashList
  // recycles cells, and a recycled cell becoming index 0 again would pull
  // focus back to the first portrait.
  const hasReciters = reciters.length > 0;
  useEffect(() => {
    if (!hasReciters) return;
    const timer = setTimeout(() => setFocusFirst(false), 1500);
    return () => clearTimeout(timer);
  }, [hasReciters]);

  const ordered = useMemo(() => featuredFirst(reciters), [reciters]);
  const available = useMemo(
    () => availableChips(reciters, rewayah),
    [reciters, rewayah],
  );
  // A lone style would filter nothing out: offer styles only when the
  // rewayah has more than one.
  const styleChips =
    available.style.size > 1
      ? STYLE_CHIPS.filter(c => available.style.has(c.key))
      : [];
  // A style the new rewayah lacks stops applying rather than emptying the
  // grid.
  const style =
    chosenStyle && styleChips.some(c => c.key === chosenStyle)
      ? chosenStyle
      : null;
  const visible = useMemo(
    () => ordered.filter(r => matchesChips(r, rewayah, style)),
    [ordered, rewayah, style],
  );

  const rewayahChips = REWAYAH_CHIPS.filter(c => available.rewayah.has(c.key));

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

  function chooseStyle(next: StyleChip | null): void {
    setFocusFirst(false);
    setStyle(next);
  }

  const filtered = rewayah !== 'all' || style !== null;

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
        {styleChips.length > 0 ? (
          <>
            <View style={styles.chipDivider} />
            <FilterChip
              label="Any style"
              selected={style === null}
              onPress={() => chooseStyle(null)}
            />
            {styleChips.map(c => (
              <FilterChip
                key={c.key}
                label={c.label}
                selected={style === c.key}
                onPress={() => chooseStyle(c.key)}
              />
            ))}
          </>
        ) : null}
      </TVFocusGuideView>
      <TVFocusGuideView autoFocus style={styles.gridWrap}>
        <ReciterGrid
          key={`${rewayah}-${style ?? 'any'}`}
          reciters={visible}
          onSelect={handleSelect}
          focusFirst={focusFirst}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {filtered
                  ? 'No reciters match these filters yet.'
                  : 'Reciters will appear here once they load.'}
              </Text>
              {/* Something to land on below the chips, so Down never
                  leaves the screen for the sidebar. */}
              {filtered ? (
                <FocusableButton
                  onPress={() => {
                    chooseRewayah('all');
                    chooseStyle(null);
                  }}
                  accessibilityLabel="Show all reciters"
                  outlined
                  style={styles.emptyButton}>
                  <FocusText style={styles.emptyButtonText}>
                    Show all reciters
                  </FocusText>
                </FocusableButton>
              ) : null}
            </View>
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
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: 13,
    paddingTop: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 20,
    fontWeight: '500',
  },
  emptyButton: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyButtonText: {
    fontFamily: fonts.bold,
    fontSize: 19,
    fontWeight: '700',
  },
});
