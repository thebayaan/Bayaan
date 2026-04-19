import React, {Component} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme/colors';

type Props = {children: React.ReactNode};
type State = {error: Error | null};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (__DEV__) {
      console.error('[tv ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({error: null});
  };

  render(): React.ReactNode {
    const {error} = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.kicker}>SOMETHING BROKE</Text>
        <Text style={styles.title}>The app hit an unexpected error</Text>
        <Text style={styles.message} numberOfLines={4}>
          {error.message || String(error)}
        </Text>
        <Pressable
          onPress={this.reset}
          accessibilityLabel="Reload the app"
          style={styles.cta}>
          <Text style={styles.ctaText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 8,
  },
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.4,
    opacity: 0.55,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 720,
    marginTop: 8,
    marginBottom: 20,
    opacity: 0.8,
  },
  cta: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: colors.text,
  },
  ctaText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
