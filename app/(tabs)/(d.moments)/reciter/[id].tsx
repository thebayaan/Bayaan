// @ai-start
import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';
import {getReciterByIdSync, getReciterBySlug} from '@/services/dataService';

/** A reciter profile inside the Moments tab, so back returns to the feed. */
const MomentsReciterProfile: React.FC = () => {
  const {id, showFavorites} = useLocalSearchParams<{
    id: string;
    showFavorites: string;
  }>();

  if (!id) {
    return null;
  }

  // Accept a slug as well as a UUID, like the other tabs' profiles.
  const resolved = getReciterByIdSync(id) ?? getReciterBySlug(id);
  const reciterId = resolved?.id ?? id;

  return <ReciterProfile id={reciterId} showLoved={showFavorites === 'true'} />;
};

export default MomentsReciterProfile;
// @ai-end
