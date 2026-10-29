/**
 * Adhkar Arabic text with its (( )) / [ ] markers rendered instead of shown:
 * the dhikr at full size and color, narration smaller and muted, additions
 * at dhikr size slightly muted, all in one flowing RTL text block. Quran
 * passages of mapped rows are drawn with Digital Khatt as their own blocks.
 */
import React, {useMemo} from 'react';
import {Text, View, type StyleProp, type TextStyle} from 'react-native';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {
  parseAdhkarArabic,
  type AdhkarSegment,
  type AdhkarSegmentKind,
} from '@/utils/adhkarText';
import {
  getAdhkarQuranPassages,
  type AdhkarQuranSpan,
} from '@/utils/adhkarQuran';
import {AdhkarQuranPassage} from './AdhkarQuranPassage';

const NARRATION_SCALE = 0.8;
const ADDITION_ALPHA = 0.75;

interface AdhkarArabicTextProps {
  dhikrId: string;
  arabic: string;
  /** Dhikr font size in px (already scaled). */
  fontSize: number;
  /** Base text style: font family, dhikr color, alignment, line height. */
  style: StyleProp<TextStyle>;
  /** Horizontal padding the base style applies, for Quran blocks. */
  horizontalPadding?: number;
  /** Alignment of Quran blocks; match the base style's textAlign. */
  align?: 'center' | 'right';
}

type Block =
  | {type: 'text'; segments: AdhkarSegment[]}
  | {type: 'quran'; segment: AdhkarSegment; span: AdhkarQuranSpan};

function toBlocks(
  segments: readonly AdhkarSegment[],
  spans: readonly AdhkarQuranSpan[],
): Block[] {
  const blocks: Block[] = [];
  for (const segment of segments) {
    const span =
      segment.quranIndex === null ? undefined : spans[segment.quranIndex];
    if (span) {
      blocks.push({type: 'quran', segment, span});
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'text') last.segments.push(segment);
    else blocks.push({type: 'text', segments: [segment]});
  }
  return blocks;
}

export function AdhkarArabicText({
  dhikrId,
  arabic,
  fontSize,
  style,
  horizontalPadding = 0,
  align = 'right',
}: AdhkarArabicTextProps): React.ReactElement {
  const {theme} = useTheme();

  const blocks = useMemo(() => {
    const passages = getAdhkarQuranPassages(dhikrId, arabic);
    return toBlocks(
      parseAdhkarArabic(arabic, passages?.ranges),
      passages?.spans ?? [],
    );
  }, [dhikrId, arabic]);

  const toneColors = useMemo(
    (): Record<AdhkarSegmentKind, string> => ({
      dhikr: theme.colors.text,
      narration: theme.colors.textSecondary,
      addition: Color(theme.colors.text).alpha(ADDITION_ALPHA).toString(),
    }),
    [theme.colors.text, theme.colors.textSecondary],
  );

  function toneSize(kind: AdhkarSegmentKind): number {
    return kind === 'narration' ? fontSize * NARRATION_SCALE : fontSize;
  }

  function toneStyle(kind: AdhkarSegmentKind): TextStyle {
    return {fontSize: toneSize(kind), color: toneColors[kind]};
  }

  function renderText(
    segments: readonly AdhkarSegment[],
    key?: string,
  ): React.ReactElement {
    return (
      <Text key={key} style={style}>
        {segments.map((segment, index) => (
          <Text key={index} style={toneStyle(segment.kind)}>
            {index > 0 ? ` ${segment.text}` : segment.text}
          </Text>
        ))}
      </Text>
    );
  }

  if (blocks.every(block => block.type === 'text')) {
    return renderText(
      blocks.flatMap(block => (block.type === 'text' ? block.segments : [])),
    );
  }

  return (
    <View style={{alignSelf: 'stretch', gap: fontSize * 0.4}}>
      {blocks.map((block, index) =>
        block.type === 'text' ? (
          renderText(block.segments, String(index))
        ) : (
          <AdhkarQuranPassage
            key={index}
            span={block.span}
            fallbackText={block.segment.text}
            fallbackStyle={[style, toneStyle(block.segment.kind)]}
            fontSize={toneSize(block.segment.kind)}
            color={toneColors[block.segment.kind]}
            horizontalPadding={horizontalPadding}
            textAlign={align}
          />
        ),
      )}
    </View>
  );
}
