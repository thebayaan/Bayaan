import React, {useEffect, useMemo} from 'react';
import {Text, View} from 'react-native';
import * as Linking from 'expo-linking';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {
  BayaanAuthError,
  bayaanAuthService,
} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

function buildFallbackUrl(params: Record<string, string | string[]>) {
  const url = new URL('bayaan://oauth/callback');
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) {
      url.searchParams.set(key, first);
    }
  }
  return url.toString();
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const currentUrl = Linking.useURL();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const fallbackUrl = useMemo(() => buildFallbackUrl(params), [params]);

  useEffect(() => {
    const callbackUrl = currentUrl?.startsWith('bayaan://oauth/callback')
      ? currentUrl
      : fallbackUrl;

    bayaanAuthService
      .handleCallbackUrl(callbackUrl)
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
  }, [currentUrl, fallbackUrl, router]);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text>Completing sign-in…</Text>
    </View>
  );
}
