import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';
import {getReciterByIdSync, getReciterBySlug} from '@/services/dataService';

const SearchReciterProfile: React.FC = () => {
  // @ai-start
  // Browse All passes the rewayah picked in its filter chips. Without it
  // the profile opened on Hafs (or the last saved rewayah) and played that.
  const {id, rewayatId} = useLocalSearchParams<{
    id: string;
    rewayatId?: string;
  }>();
  // @ai-end

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  // Universal-link visits arrive with a slug; in-app nav passes a UUID.
  const resolved = getReciterByIdSync(id) ?? getReciterBySlug(id);
  const reciterId = resolved?.id ?? id;

  return <ReciterProfile id={reciterId} initialRewayatId={rewayatId} />; // @ai
};

export default SearchReciterProfile;
