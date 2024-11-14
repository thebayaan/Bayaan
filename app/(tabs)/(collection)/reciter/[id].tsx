import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/ReciterProfile';

const CollectionReciterProfile: React.FC = () => {
  const {id, showFavorites} = useLocalSearchParams<{
    id: string;
    showFavorites: string;
  }>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  return <ReciterProfile id={id} showFavorites={showFavorites === 'true'} />;
};

export default CollectionReciterProfile;
