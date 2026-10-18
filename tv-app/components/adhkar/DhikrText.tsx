import React from 'react';
import {Text, type TextStyle} from 'react-native';
import type {Run, Tone} from '../../services/adhkarPages';
import {colors} from '../../theme/colors';

type Props = {
  runs: readonly Run[];
  /** Base style: font, size, line height, alignment, colour of the words. */
  style: TextStyle | TextStyle[];
  /** Size of the words to say; narration and references are set smaller. */
  fontSize: number;
};

// Narration and notes are set smaller, never fainter than secondary text:
// they have to read from across the room too.
const TONE_SCALE: Record<Tone, number> = {
  dhikr: 1,
  addition: 1,
  narration: 0.8,
  reference: 0.8,
};

const TONE_COLOR: Record<Tone, string> = {
  dhikr: colors.text,
  addition: 'rgba(244,243,236,0.78)',
  narration: colors.textSecondary,
  reference: colors.textSecondary,
};

/**
 * A page of dhikr text in one flowing block, the phone's markers rendered as
 * tone: the words to say in full cream, narration and notes smaller and softer.
 */
export function DhikrText({runs, style, fontSize}: Props): React.ReactElement {
  return (
    <Text style={style}>
      {runs.map((run, i) => (
        <Text
          key={i}
          style={{
            fontSize: fontSize * TONE_SCALE[run.tone],
            color: TONE_COLOR[run.tone],
          }}>
          {i > 0 ? ` ${run.text}` : run.text}
        </Text>
      ))}
    </Text>
  );
}
