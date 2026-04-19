import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {FocusableCard} from '../primitives/FocusableCard';
import {useOverlayStore} from '../../store/overlayStore';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {PlayIcon} from '../../../components/Icons';
import type {QueueItem} from '../../types/player';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const ROW_HEIGHT = 72;

export function QueueOverlay(): React.ReactElement {
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const shuffle = useTVPlayerStore(s => s.shuffle);
  const jumpToIndex = useTVPlayerStore(s => s.jumpToIndex);
  const close = useOverlayStore(s => s.close);

  const upcoming = useMemo(
    () => queue.map((item, index) => ({item, index})).slice(currentIndex),
    [queue, currentIndex],
  );

  const total = queue.length;
  const remaining = Math.max(0, total - currentIndex - 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{shuffle ? 'SHUFFLING' : 'UP NEXT'}</Text>
        <Text style={styles.title}>Queue</Text>
        <Text style={styles.sub}>
          {total} {total === 1 ? 'track' : 'tracks'}
          {remaining > 0 ? `  ·  ${remaining} coming up` : ''}
        </Text>
      </View>
      <View style={styles.listWrap}>
        <FlashList
          data={upcoming}
          keyExtractor={entry =>
            `${entry.item.reciterId}:${entry.item.surahNumber}:${entry.index}`
          }
          renderItem={({item: entry, index: rowIndex}) => (
            <QueueRow
              item={entry.item}
              index={entry.index}
              isCurrent={entry.index === currentIndex}
              hasTVPreferredFocus={rowIndex === 0}
              onSelect={async () => {
                await jumpToIndex(entry.index);
                close();
              }}
            />
          )}
        />
      </View>
    </View>
  );
}

type QueueRowProps = {
  item: QueueItem;
  index: number;
  isCurrent: boolean;
  hasTVPreferredFocus: boolean;
  onSelect: () => void;
};

function QueueRow({
  item,
  index,
  isCurrent,
  hasTVPreferredFocus,
  onSelect,
}: QueueRowProps): React.ReactElement {
  return (
    <FocusableCard
      style={styles.row}
      onPress={onSelect}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      accessibilityLabel={`${item.title} by ${item.subtitle}`}>
      <View style={styles.rowInner}>
        <View style={[styles.indexBadge, isCurrent && styles.indexBadgeActive]}>
          {isCurrent ? (
            <PlayIcon color={colors.background} size={14} />
          ) : (
            <Text style={styles.indexText}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text
            style={[styles.rowTitle, isCurrent && styles.rowTitleActive]}
            numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        {isCurrent ? <Text style={styles.nowTag}>NOW PLAYING</Text> : null}
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 820,
    maxHeight: '80%',
    padding: spacing.xl,
    gap: 6,
  },
  header: {alignItems: 'flex-start', gap: 6, marginBottom: spacing.lg},
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    opacity: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.75,
  },
  listWrap: {height: 520, width: '100%'},
  row: {
    height: ROW_HEIGHT,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
    flex: 1,
  },
  indexBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadgeActive: {backgroundColor: colors.text},
  indexText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  meta: {flex: 1},
  rowTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rowTitleActive: {color: colors.text, opacity: 1},
  rowSub: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 2,
  },
  nowTag: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    opacity: 0.8,
  },
});
