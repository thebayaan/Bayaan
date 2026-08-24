import React, {useEffect} from 'react';
import {Text, View} from 'react-native';
import * as Linking from 'expo-linking';
import {useRouter} from 'expo-router';
import {
  BayaanAuthError,
  bayaanAuthService,
} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const currentUrl = Linking.useURL();

  useEffect(() => {
    if (!currentUrl) {
      useBayaanAuthStore.getState().setError('malformed_callback');
      router.replace('/(tabs)/(d.settings)');
      return;
    }

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
