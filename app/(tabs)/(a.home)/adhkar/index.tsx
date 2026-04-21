import React from 'react';
import {useRouter} from 'expo-router';
import {AdhkarView} from '@/components/AdhkarView';
import {SuperCategory} from '@/types/adhkar';

export default function AdhkarIndexScreen() {
  const router = useRouter();

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
      headerHeight={0}
    />
  );
}
