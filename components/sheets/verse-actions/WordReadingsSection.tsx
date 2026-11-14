// @ai-generated
/**
 * The word view's Readings section: how each of the 8 bundled rewayat reads
 * the selected word, from the per-word readings index (useWordReadings).
 * Self-loading. The word view mounts it with the Hafs verse key and
 * word-by-word position of the selected word, and the rewayah the sheet shows
 * (marked Current).
 *
 * Hafs's group comes first; each differing reading follows with a tinted bar
 * and its readers, then the rewayat that do not read the word. A reader whose
 * own text differs from its group's (or carries silah) gets its own line.
 * Notes say what the readings alone do not (a word written over two Hafs
 * words, joined or apart, verse ends, al-Fatiha's basmala); a footer gives
 * the scope and the source. Quran text is only ever drawn by ReadingText
 * (DigitalKhatt), never in a UI font.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Color from 'color';
import {useSheetWidth} from '@/components/sheets/AdaptiveActionSheet';
import {REWAYAH_DIFF_BACKGROUND} from '@/constants/tajweedColors';
import {useHover} from '@/hooks/useHover';
import {useResponsive} from '@/hooks/useResponsive';
import {useTheme} from '@/hooks/useTheme';
import {useWordReadings} from '@/hooks/useWordReadings';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  READINGS_REWAYAT,
  type ReadingGroup,
  type ReadingMember,
  type ReadingsRewayah,
} from '@/services/mushaf/wordReadingsFormat';
import {
  getNarratorLabel,
  getShortLabel,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';
import {moderateScale} from '@/utils/scale';
import {latinLetterSpacing} from '@/utils/rtl';
import type {Theme} from '@/utils/themeUtils';
import ReadingText from './ReadingText';
import {
  formatNames,
  formatNarrators,
  readingNotes,
  type ReadingNotes,
} from './wordReadingsLabels';

export interface WordReadingsSectionProps {
  /** Hafs verse key of the selected word. */
  verseKey: string;
  /** Its word-by-word position (the word view's numbering). */
  wbwPosition: number;
  /** The rewayah the sheet shows: marked Current. */
  currentRewayah: RewayahId;
}

const END_OF_AYAH = String.fromCharCode(0x06dd);
// Card insets around the readings (spacing tokens lg / md) and the leading
// bar of a differing reading.
const CARD_PADDING = 16;
const BAR_WIDTH = 3;
const BAR_GAP = 12;

function isReadingsRewayah(id: RewayahId): id is ReadingsRewayah {
  return (READINGS_REWAYAT as readonly string[]).includes(id);
}

/** The current rewayah's own words at `dkPositions` when they are in memory
 *  (a word with no row: its spelling in the mushaf the reader is looking
 *  at), an inline verse number left out. */
function currentWordText(
  verseKey: string,
  dkPositions: readonly number[],
  rewayah: ReadingsRewayah,
): string | null {
  const words = digitalKhattDataService.tryGetVerseWords(verseKey, rewayah);
  if (!words) return null;
  const text = words
    .filter(w => dkPositions.includes(w.wordPositionInVerse))
    .flatMap(w => w.text.split(' '))
    .filter(token => token && !token.startsWith(END_OF_AYAH))
    .join(' ');
  return text || null;
}

export function WordReadingsSection({
  verseKey,
  wbwPosition,
  currentRewayah,
}: WordReadingsSectionProps): React.JSX.Element | null {
  const {t} = useTranslation(['sheets', 'common']);
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetWidth = useSheetWidth();
  const {isTablet} = useResponsive();
  const {hovered, hoverProps} = useHover();
  const result = useWordReadings(verseKey, wbwPosition);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setMeasuredWidth(Math.round(e.nativeEvent.layout.width));
  }, []);

  // Reading scale (ipad-standards §4.2): a word, not a verse.
  const readingSize = isTablet ? 28 : moderateScale(24);
  const memberSize = Math.round(readingSize * 0.8);
  const available = measuredWidth > 0 ? measuredWidth : sheetWidth;
  const textWidth = Math.max(
    0,
    available - CARD_PADDING * 2 - BAR_WIDTH - BAR_GAP,
  );

  const header = (
    <Text style={styles.header} accessibilityRole="header">
      {t('wordReadings.title')}
    </Text>
  );

  if (result.status === 'loading') {
    return (
      <View style={styles.section} onLayout={onLayout}>
        {header}
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      </View>
    );
  }

  if (result.status === 'error') {
    return (
      <View style={styles.section} onLayout={onLayout}>
        {header}
        <View style={styles.state}>
          <Text style={styles.note}>{t('wordReadings.loadFailed')}</Text>
          <Pressable
            onPress={result.retry}
            accessibilityRole="button"
            {...hoverProps}
            style={({pressed}) => [
              styles.retry,
              (pressed || hovered) && {
                backgroundColor: Color(theme.colors.text)
                  .alpha(pressed ? 0.06 : 0.04)
                  .toString(),
              },
            ]}>
            <Text style={styles.retryText}>{t('common:actions.tryAgain')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const {readings, dkPositions} = result;
  const notes = readingNotes(readings, dkPositions);
  const current = isReadingsRewayah(currentRewayah) ? currentRewayah : null;
  const noRow = readings.hafsText === null;
  const ownCurrent =
    noRow && current !== null && current !== 'hafs'
      ? currentWordText(verseKey, dkPositions, current)
      : null;
  let summary: string;
  if (readings.groups.length > 1) {
    summary = t('wordReadings.differs');
  } else if (notes.silah.length > 0) {
    summary = t('wordReadings.alikeWithSilah', {
      names: formatNames(notes.silah),
    });
  } else {
    summary = t('wordReadings.alike');
  }

  return (
    <View style={styles.section} onLayout={onLayout}>
      {header}
      <Text style={styles.summary}>{summary}</Text>
      {notes.span && (
        <Text style={styles.note}>
          {notes.span === 'next'
            ? t('wordReadings.readTogetherNext')
            : t('wordReadings.readTogetherPrevious')}
        </Text>
      )}
      {!noRow && (
        <View style={styles.card}>
          {readings.groups.map((group, index) => (
            <GroupRow
              key={`${group.kind}-${index}`}
              group={group}
              first={index === 0}
              currentRewayah={currentRewayah}
              readingSize={readingSize}
              memberSize={memberSize}
              textWidth={textWidth}
              styles={styles}
            />
          ))}
        </View>
      )}
      {ownCurrent !== null && current !== null && (
        <View style={styles.card}>
          <View
            style={styles.groupRow}
            accessible
            accessibilityLabel={t('wordReadings.groupA11yCurrent', {
              text: ownCurrent,
              narrators: formatNarrators([current]),
            })}>
            <View style={styles.groupBody}>
              <ReadingText
                text={ownCurrent}
                rewayah={current}
                fontSize={readingSize}
                maxWidth={textWidth}
              />
              <View style={styles.metaRow}>
                <Text style={styles.narrators}>
                  {formatNarrators([current])}
                </Text>
                <Badge label={t('wordReadings.current')} styles={styles} />
              </View>
            </View>
          </View>
        </View>
      )}
      <Notes
        notes={notes}
        currentRewayah={currentRewayah}
        covered={current !== null}
        styles={styles}
      />
      <Text style={styles.footer}>{t('wordReadings.scope')}</Text>
      <Text style={styles.footer}>{t('wordReadings.source')}</Text>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

const Badge: React.FC<{label: string; styles: Styles}> = ({label, styles}) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>
      {label}
    </Text>
  </View>
);

interface GroupRowProps {
  group: ReadingGroup;
  first: boolean;
  currentRewayah: RewayahId;
  readingSize: number;
  memberSize: number;
  textWidth: number;
  styles: Styles;
}

const GroupRow: React.FC<GroupRowProps> = ({
  group,
  first,
  currentRewayah,
  readingSize,
  memberSize,
  textWidth,
  styles,
}) => {
  const {t} = useTranslation('sheets');
  const rewayat = group.members.map(m => m.rewayah);
  const narrators = formatNarrators(rewayat);
  const isCurrent = rewayat.some(r => r === currentRewayah);
  const differs = group.kind === 'differs';
  // The group's text is its first member's own text ('differs'), Hafs's
  // ('asHafs'): drawn in that rewayah's font.
  const textOwner: ReadingsRewayah =
    group.kind === 'asHafs'
      ? 'hafs'
      : (group.members.find(m => !m.questioned) ?? group.members[0]).rewayah;
  // A reading of one reader whose own text is the group's: its silah is
  // coloured on the group's text instead of a second, identical line.
  const sole =
    group.members.length === 1 && group.members[0].ownText === group.text
      ? group.members[0]
      : null;
  const ownLines = group.members.filter(m => m.ownText !== null && m !== sole);

  let label: string;
  if (group.kind === 'notRead') {
    label = t('wordReadings.notReadA11y', {narrators});
  } else if (isCurrent) {
    label = t('wordReadings.groupA11yCurrent', {text: group.text, narrators});
  } else {
    label = t('wordReadings.groupA11y', {text: group.text, narrators});
  }

  return (
    <View style={[styles.groupRow, !first && styles.divider]}>
      {differs && <View style={styles.diffBar} />}
      <View style={styles.groupBody}>
        <View accessible accessibilityLabel={label}>
          {group.kind === 'notRead' ? (
            <Text style={styles.notRead}>{t('wordReadings.notRead')}</Text>
          ) : (
            <ReadingText
              text={group.text}
              rewayah={textOwner}
              fontSize={readingSize}
              silahChars={sole?.silahChars}
              maxWidth={textWidth}
            />
          )}
          <View style={styles.metaRow}>
            <Text style={styles.narrators}>{narrators}</Text>
            {isCurrent && (
              <Badge label={t('wordReadings.current')} styles={styles} />
            )}
          </View>
          {differs && (
            <Text style={styles.caption}>
              {t('wordReadings.differsFromHafs')}
            </Text>
          )}
        </View>
        {ownLines.map(member => (
          <MemberLine
            key={member.rewayah}
            member={member}
            memberSize={memberSize}
            textWidth={textWidth}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
};

const MemberLine: React.FC<{
  member: ReadingMember;
  memberSize: number;
  textWidth: number;
  styles: Styles;
}> = ({member, memberSize, textWidth, styles}) => {
  const {t} = useTranslation('sheets');
  const name = getNarratorLabel(member.rewayah);
  const text = member.ownText ?? '';
  return (
    <View
      style={styles.memberLine}
      accessible
      accessibilityLabel={t('wordReadings.memberA11y', {name, text})}>
      <Text style={styles.memberName}>{name}</Text>
      <ReadingText
        text={text}
        rewayah={member.rewayah}
        fontSize={memberSize}
        silahChars={member.silahChars}
        maxWidth={textWidth}
      />
    </View>
  );
};

const Notes: React.FC<{
  notes: ReadingNotes;
  currentRewayah: RewayahId;
  covered: boolean;
  styles: Styles;
}> = ({notes, currentRewayah, covered, styles}) => {
  const {t} = useTranslation('sheets');
  const lines: string[] = [];
  if (notes.joined.length > 0) {
    lines.push(
      t('wordReadings.writtenJoined', {names: formatNames(notes.joined)}),
    );
  }
  if (notes.apart.length > 0) {
    lines.push(
      t('wordReadings.writtenApart', {names: formatNames(notes.apart)}),
    );
  }
  for (const end of notes.verseEnds) {
    lines.push(
      t('wordReadings.verseEndHere', {
        verse: end.verse,
        names: formatNames(end.rewayat),
      }),
    );
  }
  if (notes.noVerseEnd.length > 0) {
    lines.push(
      t('wordReadings.noVerseEndHere', {names: formatNames(notes.noVerseEnd)}),
    );
  }
  if (notes.basmalaUnnumbered.length > 0) {
    lines.push(
      t('wordReadings.basmalaUnnumbered', {
        names: formatNames(notes.basmalaUnnumbered),
      }),
    );
  }
  if (!covered) {
    lines.push(
      t('wordReadings.contextNotCovered', {
        rewayah: getShortLabel(currentRewayah),
      }),
    );
  }
  if (lines.length === 0) return null;
  return (
    <View style={styles.notes}>
      {lines.map(line => (
        <Text key={line} style={styles.note}>
          {line}
        </Text>
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const secondary = Color(theme.colors.textSecondary).alpha(0.8).toString();
  const label = Color(theme.colors.text).alpha(0.85).toString();
  return StyleSheet.create({
    section: {
      marginTop: 20,
    },
    header: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(12),
      letterSpacing: latinLetterSpacing(0.5),
      textTransform: 'uppercase',
      color: secondary,
      marginBottom: 8,
      textAlign: 'left',
    },
    summary: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(14),
      lineHeight: moderateScale(20),
      color: label,
      textAlign: 'left',
    },
    state: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 8,
    },
    card: {
      marginTop: 12,
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
    },
    groupRow: {
      flexDirection: 'row',
      minHeight: 44,
      paddingHorizontal: CARD_PADDING,
      paddingVertical: 12,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    diffBar: {
      width: BAR_WIDTH,
      borderRadius: 2,
      backgroundColor: REWAYAH_DIFF_BACKGROUND,
      marginEnd: BAR_GAP,
    },
    groupBody: {
      flex: 1,
      alignItems: 'flex-start',
      gap: 4,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    narrators: {
      flexShrink: 1,
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(14),
      lineHeight: moderateScale(20),
      color: label,
      textAlign: 'left',
    },
    caption: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(11),
      color: secondary,
      textAlign: 'left',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    badgeText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(11),
      color: label,
    },
    notRead: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(15),
      lineHeight: moderateScale(22),
      color: label,
      textAlign: 'left',
    },
    memberLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    memberName: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(13),
      color: secondary,
    },
    notes: {
      marginTop: 12,
      gap: 4,
    },
    note: {
      fontFamily: 'Manrope-Medium',
      fontSize: moderateScale(13),
      lineHeight: moderateScale(18),
      color: secondary,
      textAlign: 'left',
    },
    footer: {
      marginTop: 8,
      fontFamily: 'Manrope-Regular',
      fontSize: moderateScale(12),
      lineHeight: moderateScale(17),
      color: secondary,
      textAlign: 'left',
    },
    retry: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 16,
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    retryText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(14),
      color: theme.colors.text,
    },
  });
};
