import React from 'react';
import {StatusBar} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {ReciterDownloadsList} from '@/components/reciter-downloads/ReciterDownloadsList';

const ReciterDownloadsScreen = () => {
  const {reciterId} = useLocalSearchParams<{reciterId: string}>();

  if (!reciterId) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ReciterDownloadsList reciterId={reciterId} />
    </>
  );
};

export default ReciterDownloadsScreen;
