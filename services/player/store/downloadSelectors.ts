import {shallow} from 'zustand/shallow';
import {useDownloadStore} from './downloadStore';

export const useDownloads = () => useDownloadStore(state => state.downloads);

export const useDownloadProgress = (id: string) =>
  useDownloadStore(state => state.downloadProgress[id] ?? 0);

export const useIsDownloading = (id: string) =>
  useDownloadStore(state => state.downloading.includes(id));

export const useIsDownloadingList = () =>
  useDownloadStore(state => state.downloading, shallow);

export const useIsDownloaded = (
  reciterId: string,
  surahId: string,
  rewayatId?: string,
) =>
  useDownloadStore(state =>
    rewayatId
      ? state.isDownloadedWithRewayat(reciterId, surahId, rewayatId)
      : state.isDownloaded(reciterId, surahId),
  );

export const useIsDownloadedWithRewayat = (
  reciterId: string,
  surahId: string,
  rewayatId: string,
) =>
  useDownloadStore(state =>
    state.isDownloadedWithRewayat(reciterId, surahId, rewayatId),
  );

export const usePlaylistDownloadProgress = (playlistId: string) =>
  useDownloadStore(state => state.playlistDownloads[playlistId] ?? null);

export const useIsPlaylistDownloading = (playlistId: string) =>
  useDownloadStore(state => state.playlistDownloads[playlistId] !== undefined);

export const useDownloadActions = () =>
  useDownloadStore(
    state => ({
      addDownload: state.addDownload,
      removeDownload: state.removeDownload,
      clearDownloads: state.clearDownloads,
      clearAllDownloads: state.clearAllDownloads,
      setDownloads: state.setDownloads,
      setDownloading: state.setDownloading,
      clearDownloading: state.clearDownloading,
      setDownloadProgress: state.setDownloadProgress,
      setPlaylistDownloadProgress: state.setPlaylistDownloadProgress,
      setError: state.setError,
      reorderDownloads: state.reorderDownloads,
    }),
    shallow,
  );

export const useDownloadQueries = () =>
  useDownloadStore(
    state => ({
      isDownloaded: state.isDownloaded,
      isDownloadedWithRewayat: state.isDownloadedWithRewayat,
      isDownloading: state.isDownloading,
      isDownloadingWithRewayat: state.isDownloadingWithRewayat,
      getDownload: state.getDownload,
      getDownloadProgress: state.getDownloadProgress,
    }),
    shallow,
  );

