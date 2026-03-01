import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import Color from 'color';
import {
  parseTafseerHtml,
  type TafseerNode,
  type TafseerNodeType,
} from '@/utils/tafseerHtmlParser';
import type {Theme} from '@/utils/themeUtils';

interface TafseerHtmlRendererProps {
  html: string;
  isRtl: boolean;
  theme: Theme;
}

const InlineNode: React.FC<{
  node: TafseerNode;
  styles: ReturnType<typeof createStyles>;
}> = ({node, styles}) => {
  const styleMap: Record<TafseerNodeType, object> = {
    text: styles.text,
    narrator: styles.narrator,
    hadith: styles.hadith,
    'quran-quote': styles.quranQuote,
    reference: styles.reference,
    heading: styles.text,
    paragraph: styles.text,
  };

  return <Text style={styleMap[node.type]}>{node.text}</Text>;
};

const BlockNode: React.FC<{
  node: TafseerNode;
  styles: ReturnType<typeof createStyles>;
}> = ({node, styles}) => {
  if (node.type === 'heading') {
    return <Text style={styles.heading}>{node.text}</Text>;
  }

  // Paragraph with inline children
  return (
    <View style={styles.paragraphWrap}>
      <Text style={styles.paragraphText}>
        {node.children?.map((child, i) => (
          <InlineNode key={i} node={child} styles={styles} />
        ))}
      </Text>
    </View>
  );
};

export const TafseerHtmlRenderer: React.FC<TafseerHtmlRendererProps> = ({
  html,
  isRtl,
  theme,
}) => {
  const nodes = useMemo(() => parseTafseerHtml(html), [html]);
  const styles = useMemo(() => createStyles(theme, isRtl), [theme, isRtl]);

  if (nodes.length === 0) return null;

  return (
    <View>
      {nodes.map((node, i) => (
        <BlockNode key={i} node={node} styles={styles} />
      ))}
    </View>
  );
};

const createStyles = (theme: Theme, isRtl: boolean) =>
  StyleSheet.create({
    heading: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: moderateScale(17),
      color: theme.colors.text,
      marginTop: verticalScale(16),
      marginBottom: verticalScale(8),
      ...(isRtl && {
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
        fontFamily: 'ScheherazadeNew-Regular',
        fontSize: moderateScale(20),
      }),
    },
    paragraphWrap: {
      marginBottom: verticalScale(10),
    },
    paragraphText: {
      ...(isRtl && {
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
      }),
    },
    text: {
      fontFamily: isRtl ? 'ScheherazadeNew-Regular' : 'Manrope-Regular',
      fontSize: isRtl ? moderateScale(18) : moderateScale(15),
      lineHeight: isRtl ? moderateScale(34) : moderateScale(26),
      color: theme.colors.textSecondary,
      ...(isRtl && {writingDirection: 'rtl' as const}),
    },
    narrator: {
      fontFamily: isRtl ? 'ScheherazadeNew-Regular' : 'Manrope-Medium',
      fontSize: isRtl ? moderateScale(18) : moderateScale(15),
      lineHeight: isRtl ? moderateScale(34) : moderateScale(26),
      color: Color(theme.colors.text).alpha(0.7).toString(),
      ...(isRtl && {writingDirection: 'rtl' as const}),
    },
    hadith: {
      fontFamily: isRtl ? 'ScheherazadeNew-Regular' : 'Manrope-Regular',
      fontSize: isRtl ? moderateScale(18) : moderateScale(15),
      lineHeight: isRtl ? moderateScale(34) : moderateScale(26),
      fontStyle: 'italic',
      color: Color(theme.colors.text).alpha(0.6).toString(),
      ...(isRtl && {writingDirection: 'rtl' as const}),
    },
    quranQuote: {
      fontFamily: 'ScheherazadeNew-Regular',
      fontSize: moderateScale(20),
      lineHeight: moderateScale(36),
      color: theme.colors.text,
      writingDirection: 'rtl',
    },
    reference: {
      fontFamily: isRtl ? 'ScheherazadeNew-Regular' : 'Manrope-Regular',
      fontSize: moderateScale(13),
      lineHeight: isRtl ? moderateScale(28) : moderateScale(22),
      color: Color(theme.colors.textSecondary).alpha(0.6).toString(),
      ...(isRtl && {writingDirection: 'rtl' as const}),
    },
  });
