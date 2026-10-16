import React, {Component, ErrorInfo, ReactNode} from 'react';
import {View, Text} from 'react-native';
// @ai-start
import i18n from '@/i18n';
// @ai-end

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// @ai-start
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return {hasError: true};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text>{i18n.t('home:errorBoundary.message')}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}
// @ai-end

export default ErrorBoundary;
