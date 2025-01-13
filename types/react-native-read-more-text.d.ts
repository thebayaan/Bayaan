declare module '@expo/react-native-read-more-text' {
  import {ReactNode} from 'react';
  import {TextProps} from 'react-native';

  interface ReadMoreProps extends TextProps {
    numberOfLines: number;
    renderTruncatedFooter: (handlePress: () => void) => ReactNode;
    renderRevealedFooter: (handlePress: () => void) => ReactNode;
    onReady?: () => void;
  }

  const ReadMore: React.FC<ReadMoreProps>;
  export default ReadMore;
}
