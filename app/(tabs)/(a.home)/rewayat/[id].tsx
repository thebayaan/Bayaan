import React from 'react';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {getRewayatById, getRecitersByRewayat} from '@/data/rewayatCollections';

export default function RewayatRecitersScreen() {
  const router = useRouter();
  const {theme} = useTheme();
  const {id} = useLocalSearchParams<{id: string}>();

  const handleBack = () => {
    router.back();
  };

  // Get rewayat info
  const rewayat = id ? getRewayatById(id) : undefined;
  const title = rewayat ? rewayat.displayName : 'Rewayat';

  // Get reciters for this rewayat
  const reciters = rewayat ? getRecitersByRewayat(rewayat.name) : [];

  return (
    <BrowseReciters
      theme={theme}
      onBack={handleBack}
      title={title}
      subtitle={rewayat?.description}
      preFilteredReciters={reciters}
    />
  );
}

