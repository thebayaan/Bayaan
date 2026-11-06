import React from 'react';
import {useRouter} from 'expo-router';
// @ai-start
import {useHeaderHeight} from 'expo-router/react-navigation';
import {useResponsive} from '@/hooks/useResponsive';
import {USE_GLASS} from '@/hooks/useGlassProps';
// @ai-end
import {AdhkarView} from '@/components/AdhkarView';
import {SuperCategory} from '@/types/adhkar';

export default function AdhkarIndexScreen() {
  const router = useRouter();
  // @ai-start
  // On iPad the page starts below the transparent header, so the Saved card
  // and the session pill aren't covered by the back button. Phones keep
  // their layout.
  const headerHeight = useHeaderHeight();
  const {isTablet} = useResponsive();
  // @ai-end

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
      headerHeight={isTablet && USE_GLASS ? headerHeight : 0} // @ai
    />
  );
}
