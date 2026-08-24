import React, {useEffect} from 'react';
import {Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {bayaanAuthService} from '@/services/auth/bayaanAuthService';
import {useBayaanAuthStore} from '@/store/bayaanAuthStore';

export default function OAuthLogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    bayaanAuthService.logout().finally(() => {
      useBayaanAuthStore.getState().setSignedOut();
      router.replace('/(tabs)/(d.settings)');
    });
  }, [router]);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text>Signing out…</Text>
    </View>
  );
}
