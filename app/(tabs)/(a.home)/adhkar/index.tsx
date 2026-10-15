import React from 'react';
import {useRouter} from 'expo-router';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {AdhkarView} from '@/components/AdhkarView';
import {SuperCategory} from '@/types/adhkar';

export default function AdhkarIndexScreen() {
  const router = useRouter();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = USE_GLASS ? rawHeaderHeight : 0;

  const handleCategoryPress = (superCategory: SuperCategory) => {
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]',
      params: {superId: superCategory.id},
    });
  };

  const handleSavedPress = () => {
    router.push('/(tabs)/(a.home)/adhkar/saved');
  };

  return (
    <AdhkarView
      onCategoryPress={handleCategoryPress}
      onSavedPress={handleSavedPress}
      headerHeight={headerHeight}
    />
  );
}
