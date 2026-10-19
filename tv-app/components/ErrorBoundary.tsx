import React, {Component} from 'react';
import {Text, View} from 'react-native';
import {FocusableButton, FocusText} from './primitives/FocusableButton';
import {setTVMenuKeyEnabled} from '../hooks/tvMenuKey';
import {useContextMenuStore} from '../store/contextMenuStore';
import {useListeningStore} from '../store/listeningStore';
import {useNavStore} from '../store/navStore';
import {useOverlayStore} from '../store/overlayStore';
import {useSettingsStore} from '../store/settingsStore';
import {colors} from '../theme/colors';
import {createScaledStyles} from '../theme/scale';
import {fonts} from '../theme/typography';

type Props = {children: React.ReactNode};
type State = {error: Error | null};

/**
 * Puts every screen-level store back to Home with nothing open, so Reload
 * renders a fresh place instead of the one that just threw. Playback stores
 * are left alone: the recitation keeps playing through the error.
 */
export function resetToHome(): void {
  useContextMenuStore.getState().close();
  useOverlayStore.getState().close();
  useListeningStore.getState().setTrayOpen(false);
  useSettingsStore.getState().setPicker(null);
  useNavStore.getState().reset();
}

/**
 * Catches a render error below it (the Router, inside the audio provider, so
 * a crashing screen never stops the recitation). Reload returns to Home.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Kept in release builds too: it reaches logcat / the device console.
    console.error('[tv ErrorBoundary]', error, info.componentStack);
    // The Router (and its back handler) is gone; let tvOS Menu leave the app
    // instead of being swallowed by a handler that no longer exists.
    setTVMenuKeyEnabled(false);
  }

  reset = (): void => {
    resetToHome();
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
        <FocusableButton
          onPress={this.reset}
          accessibilityLabel="Reload and go to Home"
          style={styles.cta}
          outlined
          hasTVPreferredFocus>
          <FocusText style={styles.ctaText}>Reload</FocusText>
        </FocusableButton>
      </View>
    );
  }
}

const styles = createScaledStyles({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 8,
  },
  kicker: {
    color: colors.accent,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.4,
    opacity: 0.55,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 720,
    marginTop: 8,
    marginBottom: 20,
    opacity: 0.8,
  },
  cta: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
