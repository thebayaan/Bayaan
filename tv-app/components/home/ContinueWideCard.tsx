import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusText} from '../primitives/focusContext';
import {SurahArtwork} from '../brand/SurahArtwork';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {ContinueEntry} from '../../services/continueListeningStore';

/** "12 min left", "Almost done", or "Started" when the length is unknown. */
function timeLeftLabel(entry: ContinueEntry): string {
  if (!entry.durationSeconds) return 'Started';
  const left = Math.max(0, entry.durationSeconds - entry.positionSeconds);
  const minutes = Math.round(left / 60);
  if (minutes < 1) return 'Almost done';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')} left`;
  }
  return `${minutes} min left`;
}

type Props = {
  entry: ContinueEntry;
  surahName: string;
  reciterName: string;
  onSelect: (entry: ContinueEntry) => void;
};

/**
 * A wide "Continue listening" card: surah art, name, reciter and time left,
 * with a thin sky progress line along the bottom edge.
 */
function ContinueWideCardImpl({
  entry,
  surahName,
  reciterName,
  onSelect,
}: Props): React.ReactElement {
  const progress = entry.durationSeconds
    ? Math.min(1, entry.positionSeconds / entry.durationSeconds)
    : 0;
  const meta = [reciterName, timeLeftLabel(entry)].filter(Boolean).join(' · ');
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(entry)}
      accessibilityLabel={`Resume ${surahName}${reciterName ? ` by ${reciterName}` : ''}`}>
      <View style={styles.body}>
        <View style={styles.thumb}>
          <SurahArtwork
            surahNumber={entry.surahNumber}
            glyphSize={48}
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
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${progress * 100}%`}]} />
      </View>
    </FocusableCard>
  );
}

export const ContinueWideCard = React.memo(ContinueWideCardImpl);

const styles = createScaledStyles({
  card: {
    width: 440,
    height: 128,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
  },
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
  text: {flex: 1, gap: 6},
  title: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 22},
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
  },
  track: {height: 4, backgroundColor: 'rgba(244,243,236,0.14)'},
  fill: {height: '100%', backgroundColor: colors.accent},
});
