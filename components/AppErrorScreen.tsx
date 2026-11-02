// @ai-generated
import React from 'react';
import {Appearance, Pressable, StyleSheet, Text, View} from 'react-native';
import {ROOT_COLORS} from '@/constants/rootColors';
import i18n from '@/i18n';

interface Props {
  message: string;
  /** Leave it out when a retry cannot help: the screen then shows no button. */
  onRetry?: () => void;
}

/**
 * Text for the error screen, with an English fallback. The screen must render
 * even when the failure came from the i18n or branding layer.
 */
export function safeText(read: () => string, fallback: string): string {
  try {
    const value = read();
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The full-screen message for a failure at the root of the app. It uses no
 * theme, safe-area or icon provider, because one of them may be what failed.
 * The colors follow the system scheme, and the top padding keeps the text clear
 * of the status bar.
 */
export default function AppErrorScreen({message, onRetry}: Props) {
  const colors =
    Appearance.getColorScheme() === 'dark'
      ? ROOT_COLORS.dark
      : ROOT_COLORS.light;
  const retryLabel = safeText(
    () => i18n.t('common:actions.tryAgain'),
    'Try again',
  );

  return (
    <View
      style={[styles.container, {backgroundColor: colors.background}]}
      testID="app-error-screen">
      <Text style={[styles.title, {color: colors.text}]}>
        {safeText(() => i18n.t('common:status.error'), 'Something went wrong')}
      </Text>
      <Text style={[styles.body, {color: colors.secondary}]}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={[styles.button, {backgroundColor: colors.text}]}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          testID="app-error-screen-retry">
          <Text style={[styles.buttonLabel, {color: colors.background}]}>
            {retryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
