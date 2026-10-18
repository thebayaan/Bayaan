import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {SurahThumb} from './SurahThumb';
import {useRailFocus} from './HomeRail';
import {timeLeftLabel} from '../../hooks/homeContinue';
import {shortReciterName} from '../../services/listeningChoices';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {ContinueEntry} from '../../services/continueListeningStore';

const CARD_W = 440;
const CARD_H = 128;
const RADIUS = 16;
const FRAME_PAD = 18; // FocusFrame ring 4 + gap 5, both sides

type Props = {
  entry: ContinueEntry;
  surahName: string;
  reciterName: string;
  onSelect: (entry: ContinueEntry) => void;
  /** Long press: the surah menu (with "Remove from Continue listening"). */
  onLongPress?: (entry: ContinueEntry) => void;
  /** Takes focus (the neighbour of a card its menu removed). */
  hasTVPreferredFocus?: boolean;
};

/**
 * A wide "Continue listening" card: the surah's calligraphy, name, reciter
 * and time left, with a thin sky progress line along the bottom edge. The
 * time left never truncates; a long reciter name gives way to it. Focus is
 * the cream ring set off the card (FocusFrame), like every other Home tile.
 */
function ContinueWideCardImpl({
  entry,
  surahName,
  reciterName,
  onSelect,
  onLongPress,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const onFocusRail = useRailFocus();
  const progress = entry.durationSeconds
    ? Math.min(1, entry.positionSeconds / entry.durationSeconds)
    : 0;
  const timeLeft = timeLeftLabel(entry);
  const voice = shortReciterName(reciterName);
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(entry)}
      onLongPress={onLongPress ? () => onLongPress(entry) : undefined}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={onFocusRail}
      accessibilityLabel={`Resume ${surahName}${reciterName ? ` by ${reciterName}` : ''}, ${timeLeft}`}>
      <FocusFrame radius={RADIUS} style={styles.frame}>
        <View style={styles.surface}>
          <View style={styles.body}>
            <View style={styles.thumb}>
              <SurahThumb
                surahNumber={entry.surahNumber}
                glyphSize={44}
                id={`home-continue-${entry.reciterId}-${entry.surahNumber}`}
              />
            </View>
            <View style={styles.text}>
              <FocusText
                style={styles.title}
                color={colors.text}
                focusedColor={colors.text}
                numberOfLines={1}>
                {surahName}
              </FocusText>
              <View style={styles.metaRow}>
                {voice ? (
                  <Text style={[styles.meta, styles.reciter]} numberOfLines={1}>
                    {voice}
                  </Text>
                ) : null}
                {voice ? <Text style={styles.meta}> · </Text> : null}
                <Text style={[styles.meta, styles.timeLeft]} numberOfLines={1}>
                  {timeLeft}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${progress * 100}%`}]} />
          </View>
        </View>
      </FocusFrame>
    </FocusableCard>
  );
}

export const ContinueWideCard = React.memo(ContinueWideCardImpl);

const styles = createScaledStyles({
  card: {width: CARD_W + FRAME_PAD},
  frame: {width: CARD_W + FRAME_PAD, height: CARD_H + FRAME_PAD},
  surface: {flex: 1, backgroundColor: colors.surfaceElevated},
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 20,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  text: {flex: 1, minWidth: 0, gap: 6},
  metaRow: {flexDirection: 'row', alignItems: 'baseline'},
  reciter: {flexShrink: 1},
  timeLeft: {flexShrink: 0},
  title: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 22},
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
  },
  track: {height: 4, backgroundColor: 'rgba(244,243,236,0.14)'},
  fill: {height: '100%', backgroundColor: colors.accent},
});
