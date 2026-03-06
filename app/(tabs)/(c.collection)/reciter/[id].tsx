import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';

const CollectionReciterProfile: React.FC = () => {
  const params = useLocalSearchParams<{
    id: string;
    rewayatSlug?: string;
    surah?: string;
    autoplay?: string;
  }>();
  
  const { id, rewayatSlug, surah, autoplay } = params;

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  return (
    <ReciterProfile 
      id={id} 
      initialRewayatSlug={rewayatSlug}
      initialSurah={surah ? parseInt(surah, 10) : undefined}
      autoplay={autoplay === 'true'}
    />
  );
};

export default CollectionReciterProfile;
