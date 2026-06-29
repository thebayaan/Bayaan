import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';
import {getReciterByIdSync, getReciterBySlug} from '@/services/dataService';

const CollectionReciterProfile: React.FC = () => {
  const {id, showFavorites} = useLocalSearchParams<{
    id: string;
    showFavorites: string;
  }>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  // Universal-link visits arrive with a slug; in-app nav passes a UUID.
  const resolved = getReciterByIdSync(id) ?? getReciterBySlug(id);
  const reciterId = resolved?.id ?? id;

  return <ReciterProfile id={reciterId} showLoved={showFavorites === 'true'} />;
};

export default CollectionReciterProfile;
