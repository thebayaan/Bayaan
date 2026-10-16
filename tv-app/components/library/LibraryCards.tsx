import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {
  FocusFrame,
  FocusText,
  useButtonFocused,
} from '../primitives/focusContext';
import {GradientFill} from '../brand/GradientFill';
import {SurahGlyph} from '../brand/SurahGlyph';
import {surahGradient} from '../../theme/surahColors';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import type {ContinueEntry} from '../../services/continueListeningStore';

/** "12 min left", "Almost done", or "Started" when the length is unknown. */
export function timeLeftLabel(entry: ContinueEntry): string {
  if (!entry.durationSeconds) return 'Started';
  const left = Math.max(0, entry.durationSeconds - entry.positionSeconds);
  const minutes = Math.round(left / 60);
  if (minutes < 1) return 'Almost done';
  return `${minutes} min left`;
}

function progressOf(entry: ContinueEntry): number {
  return entry.durationSeconds
    ? Math.min(1, entry.positionSeconds / entry.durationSeconds)
    : 0;
}

function SurahArt({
  surahNumber,
  glyphSize,
  id,
  progress,
}: {
  surahNumber: number;
  glyphSize: number;
  id: string;
  progress?: number;
}): React.ReactElement {
  return (
    <View style={styles.art}>
      <GradientFill colors={surahGradient(surahNumber)} id={id} />
      <SurahGlyph surahNumber={surahNumber} size={glyphSize} />
      {progress !== undefined ? (
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${progress * 100}%`}]} />
        </View>
      ) : null}
    </View>
  );
}

type EntryProps = {
  entry: ContinueEntry;
  surahName: string;
  reciterName: string;
  onSelect: (entry: ContinueEntry) => void;
  hasTVPreferredFocus?: boolean;
};

/**
 * The most recent unfinished surah, large: its calligraphy on its pigment,
 * where it stopped, and a Resume pill that fills cream on focus.
 */
export function ResumeHero({
  entry,
  surahName,
  reciterName,
  onSelect,
  hasTVPreferredFocus,
}: EntryProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      focusScale={1.02}
      style={styles.hero}
      onPress={() => onSelect(entry)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Resume ${surahName} by ${reciterName}`}>
      <FocusFrame radius={18} style={styles.heroFrame}>
        <SurahArt
          surahNumber={entry.surahNumber}
          glyphSize={120}
          id={`library-hero-${entry.surahNumber}`}
          progress={progressOf(entry)}
        />
      </FocusFrame>
      <View style={styles.heroText}>
        <Text style={styles.eyebrow}>Pick up where you left off</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>
          {surahName}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {reciterName} · {timeLeftLabel(entry)}
        </Text>
        <ResumePill />
      </View>
    </FocusableCard>
  );
}

function ResumePill(): React.ReactElement {
  const focused = useButtonFocused();
  return (
    <View style={[styles.pill, focused && styles.pillFocused]}>
      <FocusText style={styles.pillText}>Resume</FocusText>
    </View>
  );
}

/** An unfinished surah in the row under the hero. */
export function SurahProgressCard({
  entry,
  surahName,
  reciterName,
  onSelect,
}: EntryProps): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={() => onSelect(entry)}
      accessibilityLabel={`Resume ${surahName} by ${reciterName}`}>
      <FocusFrame radius={14} style={styles.cardFrame}>
        <SurahArt
          surahNumber={entry.surahNumber}
          glyphSize={72}
          id={`library-card-${entry.reciterId}-${entry.surahNumber}`}
          progress={progressOf(entry)}
        />
      </FocusFrame>
      <View style={styles.cardText}>
        <FocusText
          style={styles.cardTitle}
          color={colors.text}
          focusedColor={colors.text}
          numberOfLines={1}>
          {surahName}
        </FocusText>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {reciterName} · {timeLeftLabel(entry)}
        </Text>
      </View>
    </FocusableCard>
  );
}

const styles = createScaledStyles({
  art: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 6,
    backgroundColor: 'rgba(6,21,28,0.45)',
  },
  fill: {height: '100%', backgroundColor: colors.text},
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
    alignSelf: 'flex-start',
  },
  heroFrame: {width: 520, height: 300},
  heroText: {width: 640, gap: 10},
  eyebrow: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 60,
    letterSpacing: -1.2,
  },
  heroMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 22,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.outline,
  },
  pillFocused: {
    backgroundColor: colors.focusFill,
    borderColor: colors.focusFill,
  },
  pillText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 20},
  card: {width: 300, gap: 12},
  cardFrame: {width: 300, height: 180},
  cardText: {paddingHorizontal: 9, gap: 3},
  cardTitle: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 20},
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 16,
  },
});
