import React from 'react';
import {Text, StyleSheet, TextStyle, StyleProp} from 'react-native';

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
      styleStack.push([currentStyle, styles.superscript]);

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
        styleStack.push([currentStyle, styles.superscript]);
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
              style={[currentStyle, styles.superscript, styles.footnoteText]}
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

  return <Text style={baseStyle}>{elements}</Text>;
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
  superscript: {
    fontSize: 14, // Increased font size
    lineHeight: 18, // Adjusted line height for new font size
    includeFontPadding: false,
  },
  footnoteContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingHorizontal: 4, // Added horizontal padding for larger touch area
    paddingVertical: 2, // Added vertical padding for larger touch area
  },
  footnoteText: {
    color: '#3498db',
    fontWeight: 'bold', // Keep it bold
  },
});

export default FormattedTextRenderer;
