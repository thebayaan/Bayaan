import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {ReciterDownloadsList} from '@/components/reciter-downloads/ReciterDownloadsList';

const ReciterDownloadsScreen = () => {
  const {reciterId} = useLocalSearchParams<{reciterId: string}>();

  if (!reciterId) {
    return null;
  }

  // @ai: no StatusBar override. The list sits on the theme background, so
  // the tabs layout's themed status bar applies; a forced light-content bar
  // was white-on-white in light mode.
  return <ReciterDownloadsList reciterId={reciterId} />;
};

export default ReciterDownloadsScreen;
