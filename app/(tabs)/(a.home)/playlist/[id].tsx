import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import PlaylistDetail from '@/components/playlist-detail/PlaylistDetail';

const HomePlaylistDetail: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();

  if (!id) {
    return null; // Handle the absence of id appropriately
  }

  return <PlaylistDetail id={id} />;
};

export default HomePlaylistDetail;
