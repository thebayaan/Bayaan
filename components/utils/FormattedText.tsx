import React from 'react';
import {Text, StyleSheet, TextStyle, StyleProp, Platform} from 'react-native';

interface FormattedTextProps {
  text: string;
  baseStyle: StyleProp<TextStyle>;
  onFootnotePress?: (footnoteId: string, footnoteNumber: string) => void;
}

function FormattedTextRenderer({
  text,
  baseStyle,
  onFootnotePress,
}: FormattedTextProps) {
  // Extract base fontSize from style for relative sizing of superscript
  let baseFontSize = 14; // Default
  if (baseStyle && typeof baseStyle !== 'function') {
    const flattenedStyle = StyleSheet.flatten(baseStyle);
    if (flattenedStyle.fontSize) {
      baseFontSize = flattenedStyle.fontSize;
    }
  }

  // Calculate relative sizes for superscript
  const superscriptFontSize = Math.max(baseFontSize * 0.75, 10); // Relative to base font size
  const superscriptLineHeight = Math.max(baseFontSize * 1.3, 16); // Relative line height

  const parts = text.split(/(<\/?(?:b|i|u|sup)(?:\s+[^>]*)?\/?>)/);

  const elements: React.ReactNode[] = [];
  const styleStack: StyleProp<TextStyle>[] = [baseStyle];

  let captureFootnote = false;
  let footnoteText = '';
  let footnoteId = '';

  parts.forEach((part, index) => {
    if (!part) return; // Skip empty strings resulting from split

    const currentStyle = styleStack[styleStack.length - 1];

    if (part.startsWith('<sup') && part.includes('foot_note')) {
      captureFootnote = true;
      styleStack.push([
        currentStyle,
        {
          fontSize: superscriptFontSize,
          lineHeight: superscriptLineHeight,
          includeFontPadding: false,
          ...Platform.select({
            android: {
              textAlignVertical: 'top',
              paddingTop: 2, // Small padding on Android to improve alignment
            },
          }),
        },
      ]);

      const match = part.match(/foot_note="([^"]+)"/);
      footnoteId = match ? match[1] : '';

      return; // Skip adding this part
    }

    switch (part) {
      case '<b>':
        styleStack.push([currentStyle, styles.bold]);
        break;
      case '<i>': // Handle italic
        styleStack.push([currentStyle, styles.italic]);
        break;
      case '<u>': // Handle underline
        styleStack.push([currentStyle, styles.underline]);
        break;
      case '<sup>': // Handle regular superscript
        styleStack.push([
          currentStyle,
          {
            fontSize: superscriptFontSize,
            lineHeight: superscriptLineHeight,
            includeFontPadding: false,
            ...Platform.select({
              android: {
                textAlignVertical: 'top',
                paddingTop: 2,
              },
            }),
          },
        ]);
        break;
      case '</b>':
      case '</i>':
      case '</u>':
        if (styleStack.length > 1) {
          styleStack.pop();
        }
        break;
      case '</sup>': {
        if (styleStack.length > 1) {
          styleStack.pop();
        }
        captureFootnote = false;

        // Capture the current values *before* they might be reset or changed by the next iteration
        const currentFootnoteId = footnoteId;
        const currentFootnoteText = footnoteText;

        if (currentFootnoteText) {
          // Check the captured value
          elements.push(
            <Text
              key={`footnote-${index}`}
              onPress={() => {
                if (onFootnotePress) {
                  onFootnotePress(currentFootnoteId, currentFootnoteText);
                }
              }}
              style={[
                currentStyle,
                {
                  fontSize: superscriptFontSize,
                  lineHeight: superscriptLineHeight,
                  includeFontPadding: false,
                  color: '#3498db',
                  fontWeight: 'bold',
                  ...Platform.select({
                    android: {
                      textAlignVertical: 'top',
                      paddingTop: 2,
                    },
                  }),
                },
              ]}
              accessibilityRole="button">
              {`[${currentFootnoteText}]`}
            </Text>,
          );
        }
        // Reset the original variables for the next potential footnote
        footnoteText = '';
        footnoteId = '';
        break;
      }
      default: {
        if (captureFootnote) {
          footnoteText = part;
        } else {
          elements.push(
            <Text key={index} style={currentStyle}>
              {part}
            </Text>,
          );
        }
        break;
      }
    }
  });

  return (
    <Text
      style={[
        baseStyle,
        Platform.OS === 'android' ? {lineHeight: baseFontSize * 1.4} : null,
      ]}>
      {elements}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: 'Manrope-Bold', // Make sure 'Manrope-Bold' is loaded in your project
    // fontWeight: 'bold', // fontWeight can conflict with custom fonts, use fontFamily preferably
  },
  italic: {
    fontFamily: 'Manrope-Italic', // Make sure 'Manrope-Italic' is loaded
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});

export default FormattedTextRenderer;
