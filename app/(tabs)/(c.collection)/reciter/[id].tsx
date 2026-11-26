import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';
import {getReciterByIdSync, getReciterBySlug} from '@/services/dataService';

const CollectionReciterProfile: React.FC = () => {
  // @ai-start
  // `rewayatId` is the rewayah the caller wants opened, as on the Home tab's
  // copy of this route. Without it the profile opened on Hafs (or the last
  // saved rewayah).
  const {id, showFavorites, rewayatId} = useLocalSearchParams<{
    id: string;
    showFavorites: string;
    rewayatId?: string;
  }>();
  // @ai-end

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  // Universal-link visits arrive with a slug; in-app nav passes a UUID.
  const resolved = getReciterByIdSync(id) ?? getReciterBySlug(id);
  const reciterId = resolved?.id ?? id;

  // @ai-start
  return (
    <ReciterProfile
      id={reciterId}
      showLoved={showFavorites === 'true'}
      initialRewayatId={rewayatId}
    />
  );
  // @ai-end
};

export default CollectionReciterProfile;
