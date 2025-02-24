import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterProfile from '@/components/reciter-profile/ReciterProfile';

const HomeReciterProfile: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  return <ReciterProfile id={id} />;
};

export default HomeReciterProfile;
