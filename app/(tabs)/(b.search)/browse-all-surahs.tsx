import React from 'react';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseSurahs from '@/components/browse/BrowseSurahs';

export default function BrowseAllSurahsScreen() {
  const router = useRouter();
  const {theme} = useTheme();

  const handleBack = () => {
    router.back();
  };

  return <BrowseSurahs theme={theme} onBack={handleBack} />;
}
