import React from 'react';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';

export default function BrowseAllScreen() {
  const router = useRouter();
  const {theme} = useTheme();

  const handleBack = () => {
    router.back();
  };

  return <BrowseReciters theme={theme} onBack={handleBack} />;
}
