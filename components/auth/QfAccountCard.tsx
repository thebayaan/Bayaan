import React, {useCallback} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import {bayaanAuthConfig} from '@/config/bayaanAuth';
import {
  BayaanAuthError,
  bayaanAuthService,
} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';
import type {Theme} from '@/utils/themeUtils';
import {QfSyncStatusRow} from './QfSyncStatusRow';
import {qfSyncLifecycle} from '@/services/sync/qfSyncLifecycle';
import {qfSettingsSyncLifecycle} from '@/services/settings/qfSettingsSyncLifecycle';

export function QfAccountCard() {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {status, profile, errorCode, setSigningIn, setSignedOut, setError} =
    useBayaanAuthStore();

  const signIn = useCallback(async () => {
    const attempt = setSigningIn();
    try {
      const session = await bayaanAuthService.signIn();
      useBayaanAuthStore.getState().setAuthenticated(session.profile, attempt);
    } catch (error) {
      setError(
        error instanceof BayaanAuthError ? error.code : 'sign_in_failed',
        attempt,
      );
    }
  }, [setError, setSigningIn]);

  const signOut = useCallback(async () => {
    const attempt = useBayaanAuthStore.getState().invalidateAttempt();
    await Promise.allSettled([
      qfSyncLifecycle.stop(),
      qfSettingsSyncLifecycle.stop(true),
    ]);
    // A newer login may have started while lifecycle shutdown yielded.
    if (attempt !== useBayaanAuthStore.getState().authAttempt) return;
    try {
      await bayaanAuthService.logout();
    } catch {
      // Logout attempts local cleanup even when remote revocation is offline.
      // Do not leak its rejection from a native press handler.
    } finally {
      setSignedOut(attempt);
    }
  }, [setSignedOut]);

  if (!bayaanAuthConfig.qfSyncEnabled) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Quran.Foundation account</Text>
        <Text style={styles.description}>Account sync is not enabled yet.</Text>
        <QfSyncStatusRow />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Quran.Foundation account</Text>
      {status === 'authenticated' && profile ? (
        <>
          <Text style={styles.description}>
            Signed in{profile.email ? ` as ${profile.email}` : ''}
          </Text>
          <QfSyncStatusRow />
          <Pressable style={styles.button} onPress={signOut}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.description}>
            Sign in to sync bookmarks, private notes, and reading progress.
          </Text>
          <QfSyncStatusRow />
          {status === 'error' && errorCode ? (
            <Text style={styles.error}>
              Could not sign in. Please try again.
            </Text>
          ) : null}
          <Pressable
            style={styles.button}
            onPress={signIn}
            disabled={status === 'signing_in'}>
            {status === 'signing_in' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    card: {
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderRadius: moderateScale(14),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
      padding: moderateScale(14),
    },
    title: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    description: {
      marginTop: moderateScale(4),
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(17),
    },
    error: {
      marginTop: moderateScale(8),
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.error,
    },
    button: {
      marginTop: moderateScale(12),
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: moderateScale(38),
      borderRadius: moderateScale(12),
      backgroundColor: theme.colors.text,
    },
    buttonText: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.background,
    },
  });
