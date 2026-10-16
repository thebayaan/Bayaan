/**
 * Adhkar translation or transliteration with its brackets rendered instead
 * of shown, the way AdhkarArabicText renders the Arabic: the dhikr in the
 * base style, narration (count notes, instructions, footnotes) smaller and
 * muted, additions slightly muted, ayah numbers and surah labels small and
 * muted (a label starts a new line).
 */
import React, {useMemo} from 'react';
import {Text, type StyleProp, type TextStyle} from 'react-native';
import Color from 'color';
import {
  parseAdhkarArabic,
  segmentAdhkarTranslation,
  type AdhkarSegmentKind,
  type AdhkarTranslationKind,
} from '@/utils/adhkarText';

const NARRATION_SCALE = 0.85;
const REFERENCE_SCALE = 0.75;
const MUTED_FADE = 0.3;
const ADDITION_FADE = 0.25;

type LatinKind = AdhkarSegmentKind | AdhkarTranslationKind;

interface AdhkarLatinTextProps {
  text: string;
  variant: 'translation' | 'transliteration';
  /** Base font size in px (already scaled). */
  fontSize: number;
  /** Base text color; narration and additions are faded from it. */
  color: string;
  /** Base text style: font family, color, alignment, line height. */
  style: StyleProp<TextStyle>;
}

function segmentsOf(
  text: string,
  variant: AdhkarLatinTextProps['variant'],
): {kind: LatinKind; text: string}[] {
  return variant === 'translation'
    ? segmentAdhkarTranslation(text)
    : parseAdhkarArabic(text);
}

export function AdhkarLatinText({
  text,
  variant,
  fontSize,
  color,
  style,
}: AdhkarLatinTextProps): React.ReactElement {
  const segments = useMemo(() => segmentsOf(text, variant), [text, variant]);

  const toneStyles = useMemo((): Record<LatinKind, TextStyle> => {
    const muted = Color(color).fade(MUTED_FADE).toString();
    return {
      dhikr: {},
      narration: {fontSize: fontSize * NARRATION_SCALE, color: muted},
      addition: {color: Color(color).fade(ADDITION_FADE).toString()},
      reference: {fontSize: fontSize * REFERENCE_SCALE, color: muted},
    };
  }, [color, fontSize]);

  function separator(kind: LatinKind, segmentText: string): string {
    return kind === 'reference' && !/^\d+$/.test(segmentText) ? '\n' : ' ';
  }

  return (
    <Text style={style}>
      {segments.map((segment, index) => (
        <Text key={index} style={toneStyles[segment.kind]}>
          {index > 0
            ? `${separator(segment.kind, segment.text)}${segment.text}`
            : segment.text}
        </Text>
      ))}
    </Text>
  );
}
