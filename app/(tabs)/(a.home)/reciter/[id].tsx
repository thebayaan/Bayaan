import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';

const HomeReciterProfile: React.FC = () => {
  const {id, rewayatId} = useLocalSearchParams<{
    id: string;
    rewayatId?: string;
  }>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  return <ReciterProfile id={id} initialRewayatId={rewayatId} />;
};

export default HomeReciterProfile;
