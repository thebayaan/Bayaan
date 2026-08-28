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

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const currentUrl = Linking.useLinkingURL();
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (callbackHandled.current) {
      return;
    }

    if (!currentUrl) {
      const timeout = setTimeout(() => {
        callbackHandled.current = true;
        useBayaanAuthStore.getState().setError('malformed_callback');
        router.replace('/(tabs)/(d.settings)');
      }, CALLBACK_URL_WAIT_MS);

      return () => clearTimeout(timeout);
    }

    callbackHandled.current = true;

    bayaanAuthService
      .handleCallbackUrl(currentUrl)
      .then(session => {
        useBayaanAuthStore.getState().setAuthenticated(session.profile);
        router.replace('/(tabs)/(d.settings)');
      })
      .catch(error => {
        useBayaanAuthStore
          .getState()
          .setError(
            error instanceof BayaanAuthError ? error.code : 'auth_failed',
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
