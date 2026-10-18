import React, {useMemo, useRef, useState} from 'react';
import {ScrollView, Text, TVFocusGuideView, View} from 'react-native';
import {AdhkarChip} from '../components/adhkar/AdhkarChip';
import {AdhkarClock, useNow} from '../components/adhkar/AdhkarClock';
import {AdhkarListCard} from '../components/adhkar/AdhkarListCard';
import {
  adhkarGroups,
  groupLists,
  nowListId,
  periodLabel,
  type AdhkarGroupId,
} from '../services/adhkarBrowse';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles} from '../theme/scale';
import {
  SCREEN_CLOCK_RIGHT,
  SCREEN_CLOCK_TOP,
  SCREEN_GUTTER,
} from '../theme/spacing';

// Layout in design px: the screen beside the folded sidebar (1920 - 112).
const PAD_LEFT = SCREEN_GUTTER;
const PAD_RIGHT = SCREEN_GUTTER;
const COLUMNS = 4;
const GAP = 28;
const CARD_WIDTH = Math.floor(
  (1920 - 112 - PAD_LEFT - PAD_RIGHT - GAP * (COLUMNS - 1)) / COLUMNS,
);

const INITIAL_GROUP: AdhkarGroupId = 'daily';
// The chip picked last time, so coming back to Adhkar keeps the place.
let lastGroup: AdhkarGroupId = INITIAL_GROUP;

/**
 * Adhkar browse: the phone's lists under chips (Daily, Prayer, At home,
 * Travel, Hardship, All), the main ones as big illustrated cards with the
 * list for the time of day marked NOW, the rest as smaller cards.
 */
export function AdhkarScreen(): React.ReactElement {
  const now = useNow();
  const groups = useMemo(adhkarGroups, []);
  const [groupId, setGroupId] = useState<AdhkarGroupId>(lastGroup);
  // Initial focus goes to the NOW card once, chosen as the screen opens: the
  // NOW badge moves with the clock, focus never does. After the chips have
  // been used, re-rendering a group must not pull focus back to a card.
  const [initialId] = useState(() => {
    const {featured, rest} = groupLists(lastGroup);
    const lists = [...featured, ...rest];
    const id = nowListId(new Date());
    return (lists.find(l => l.id === id) ?? lists[0])?.id;
  });
  const [chipsUsed, setChipsUsed] = useState(false);
  // OK on the selected chip moves focus to the group's first card: that card
  // mounts afresh (a new key) with preferred focus, which takes it.
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    n: number;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Focus coming up from the cards lands on the selected chip.
  const [selectedChip, setSelectedChip] = useState<View | null>(null);
  const push = useNavStore(s => s.push);

  const nowId = nowListId(now);
  const {featured, rest} = useMemo(() => groupLists(groupId), [groupId]);
  const all = [...featured, ...rest];
  const preferredId = chipsUsed ? null : initialId;

  const select = (id: AdhkarGroupId): void => {
    if (id === groupId) return;
    lastGroup = id;
    setChipsUsed(true);
    setFocusTarget(null);
    setGroupId(id);
    scrollRef.current?.scrollTo({y: 0, animated: false});
  };

  const focusFirstCard = (): void => {
    const first = all[0];
    if (!first) return;
    setChipsUsed(true);
    setFocusTarget(t => ({id: first.id, n: (t?.n ?? 0) + 1}));
  };

  const cardKey = (id: string): string =>
    focusTarget?.id === id ? `${id}-${focusTarget.n}` : id;
  const prefers = (id: string): boolean =>
    id === preferredId || id === focusTarget?.id;

  const open = (listId: string): void => push({screen: 'adhkarReader', listId});

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Adhkar</Text>
      </View>

      <TVFocusGuideView
        autoFocus
        destinations={selectedChip ? [selectedChip] : undefined}
        style={styles.chips}>
        {groups.map(group => (
          <AdhkarChip
            key={group.id}
            ref={group.id === groupId ? setSelectedChip : undefined}
            label={group.label}
            count={group.id === 'all' ? group.listIds.length : undefined}
            selected={group.id === groupId}
            onSelect={() => select(group.id)}
            onPress={() =>
              group.id === groupId ? focusFirstCard() : select(group.id)
            }
          />
        ))}
      </TVFocusGuideView>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <TVFocusGuideView autoFocus style={styles.grid}>
          {featured.map(list => (
            <AdhkarListCard
              key={cardKey(list.id)}
              list={list}
              size="big"
              width={CARD_WIDTH}
              now={list.id === nowId}
              onPress={() => open(list.id)}
              hasTVPreferredFocus={prefers(list.id)}
            />
          ))}
          {rest.map(list => (
            <AdhkarListCard
              key={cardKey(list.id)}
              list={list}
              size="small"
              width={CARD_WIDTH}
              now={list.id === nowId}
              onPress={() => open(list.id)}
              hasTVPreferredFocus={prefers(list.id)}
            />
          ))}
        </TVFocusGuideView>
      </ScrollView>

      {/* Where every root screen keeps its clock, so switching places never
          moves it. */}
      <View style={styles.clock} pointerEvents="none">
        <AdhkarClock now={now} caption={periodLabel(now)} />
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1, backgroundColor: colors.background, paddingTop: 64},
  header: {
    paddingLeft: PAD_LEFT,
    paddingRight: PAD_RIGHT,
  },
  clock: {
    position: 'absolute',
    top: SCREEN_CLOCK_TOP,
    right: SCREEN_CLOCK_RIGHT,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 60,
  },
  chips: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingLeft: PAD_LEFT - 24,
  },
  scroll: {flex: 1, marginTop: 12},
  content: {
    paddingLeft: PAD_LEFT,
    paddingRight: PAD_RIGHT,
    paddingTop: 20,
    paddingBottom: 90,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: GAP},
});
