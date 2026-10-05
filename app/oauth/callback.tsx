import React, {useEffect, useRef} from 'react';
import {Text, View} from 'react-native';
import * as Linking from 'expo-linking';
import {useRouter} from 'expo-router';
import {
  BayaanAuthError,
  bayaanAuthService,
} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

const CALLBACK_URL_WAIT_MS = 2_000;

// A failed callback must not disturb an existing session: any app or web page
// can open bayaan://oauth/callback, so a forged or stale link would otherwise
// drop a signed-in user into guest scope until restart.
function reportCallbackFailure(code: string, attempt: number): void {
  const auth = useBayaanAuthStore.getState();
  if (auth.status === 'authenticated') return;
  auth.setError(code, attempt);
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const currentUrl = Linking.useLinkingURL();
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (callbackHandled.current) {
      return;
    }

    const auth = useBayaanAuthStore.getState();
    const attempt =
      currentUrl && auth.status === 'initializing'
        ? auth.setSigningIn() // Cold-start callback supersedes startup restore.
        : auth.authAttempt;

    if (!currentUrl) {
      const timeout = setTimeout(() => {
        if (attempt !== useBayaanAuthStore.getState().authAttempt) return;
        callbackHandled.current = true;
        reportCallbackFailure('malformed_callback', attempt);
        router.replace('/(tabs)/(d.settings)');
      }, CALLBACK_URL_WAIT_MS);

      return () => clearTimeout(timeout);
    }

    callbackHandled.current = true;

    bayaanAuthService
      .handleCallbackUrl(currentUrl)
      .then(session => {
        if (attempt !== useBayaanAuthStore.getState().authAttempt) return;
        useBayaanAuthStore
          .getState()
          .setAuthenticated(session.profile, attempt);
        router.replace('/(tabs)/(d.settings)');
      })
      .catch(error => {
        if (attempt !== useBayaanAuthStore.getState().authAttempt) return;
        reportCallbackFailure(
          error instanceof BayaanAuthError ? error.code : 'auth_failed',
          attempt,
        );
        router.replace('/(tabs)/(d.settings)');
      });
  }, [currentUrl, router]);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text>Completing sign-in…</Text>
    </View>
  );
}
