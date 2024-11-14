import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import ReciterBrowse from '@/components/ReciterBrowse';

const BrowseScreen: React.FC = () => {
  const {view, surahId} = useLocalSearchParams<{
    view: string;
    surahId: string;
  }>();

  return <ReciterBrowse initialView={view} surahId={surahId} />;
};

export default BrowseScreen;
