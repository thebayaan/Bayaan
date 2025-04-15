import React from 'react';
import {Text, StyleSheet, TextStyle, StyleProp} from 'react-native';

interface FormattedTextProps {
  text: string;
  baseStyle: StyleProp<TextStyle>;
}

function FormattedTextRenderer({text, baseStyle}: FormattedTextProps) {
  const parts = text.split(/(<\/?(?:b|i|u)>)/);

  const elements: React.ReactNode[] = [];
  const styleStack: StyleProp<TextStyle>[] = [baseStyle];

  parts.forEach((part, index) => {
    if (!part) return; // Skip empty strings resulting from split

    const currentStyle = styleStack[styleStack.length - 1];

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
      case '</b>':
      case '</i>':
      case '</u>':
        if (styleStack.length > 1) {
          styleStack.pop();
        }
        break;
      default:
        elements.push(
          <Text key={index} style={currentStyle}>
            {part}
          </Text>,
        );
        break;
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
});

export default FormattedTextRenderer;
