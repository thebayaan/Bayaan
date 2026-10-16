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

// Layout in design px: the screen beside the folded sidebar (1920 - 112).
const PAD_LEFT = 72;
const PAD_RIGHT = 90;
const COLUMNS = 4;
const GAP = 28;
const CARD_WIDTH = Math.floor(
  (1920 - 112 - PAD_LEFT - PAD_RIGHT - GAP * (COLUMNS - 1)) / COLUMNS,
);

const INITIAL_GROUP: AdhkarGroupId = 'daily';
// The chip picked last time, so coming back to Adhkar keeps the place.
let lastGroup: AdhkarGroupId = INITIAL_GROUP;

/**
 * Adhkar browse: the phone's lists under chips (Daily, Prayer, Home,
 * Travel, Hardship, All), the main ones as big illustrated cards with the
 * list for the time of day marked NOW, the rest as smaller cards.
 */
export function AdhkarScreen(): React.ReactElement {
  const now = useNow();
  const groups = useMemo(adhkarGroups, []);
  const [groupId, setGroupId] = useState<AdhkarGroupId>(lastGroup);
  // Initial focus goes to the NOW card once; after the chips have been used,
  // re-rendering a group must not pull focus back to a card.
  const [chipsUsed, setChipsUsed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Focus coming up from the cards lands on the selected chip.
  const [selectedChip, setSelectedChip] = useState<View | null>(null);
  const push = useNavStore(s => s.push);

  const nowId = nowListId(now);
  const {featured, rest} = useMemo(() => groupLists(groupId), [groupId]);
  const all = [...featured, ...rest];
  const preferredId = chipsUsed
    ? null
    : (all.find(l => l.id === nowId) ?? all[0])?.id;

  const select = (id: AdhkarGroupId): void => {
    if (id === groupId) return;
    lastGroup = id;
    setChipsUsed(true);
    setGroupId(id);
    scrollRef.current?.scrollTo({y: 0, animated: false});
  };

  const open = (listId: string): void => push({screen: 'adhkarReader', listId});

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Adhkar</Text>
        <AdhkarClock now={now} caption={periodLabel(now)} />
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
              key={list.id}
              list={list}
              size="big"
              width={CARD_WIDTH}
              now={list.id === nowId}
              onPress={() => open(list.id)}
              hasTVPreferredFocus={list.id === preferredId}
            />
          ))}
          {rest.map(list => (
            <AdhkarListCard
              key={list.id}
              list={list}
              size="small"
              width={CARD_WIDTH}
              now={list.id === nowId}
              onPress={() => open(list.id)}
              hasTVPreferredFocus={list.id === preferredId}
            />
          ))}
        </TVFocusGuideView>
      </ScrollView>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1, backgroundColor: colors.background, paddingTop: 64},
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: PAD_LEFT,
    paddingRight: PAD_RIGHT,
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
