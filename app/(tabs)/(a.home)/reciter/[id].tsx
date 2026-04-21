import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';
import {getReciterByIdSync, getReciterBySlug} from '@/services/dataService';

const HomeReciterProfile: React.FC = () => {
  const {id, rewayatId} = useLocalSearchParams<{
    id: string;
    rewayatId?: string;
  }>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  // Universal-link visits arrive with a slug (e.g. "mishary-alafasi");
  // in-app navigations pass a UUID. Resolve either.
  const resolved = getReciterByIdSync(id) ?? getReciterBySlug(id);
  const reciterId = resolved?.id ?? id;

  return <ReciterProfile id={reciterId} initialRewayatId={rewayatId} />;
};

export default HomeReciterProfile;
