import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
} from 'react';
import {View, StyleSheet} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Surah} from '@/data/surahData';
import {SurahOptionsModal} from '@/components/modals/SurahOptionsModal';
import {RewayatInfoModal} from '@/components/modals/RewayatInfoModal';
import {FavoriteRecitersModal} from '@/components/modals/FavoriteRecitersModal';
import {SelectReciterModal} from '@/components/modals/SelectReciterModal';
import {PlaylistContextMenu} from '@/components/modals/PlaylistContextMenu';
import type {RewayatStyle} from '@/types/reciter';

interface ModalContextType {
  showSurahOptions: (
    surah: Surah,
    reciterId?: string,
    onAddToQueue?: (surah: Surah) => Promise<void>,
    rewayatId?: string,
  ) => void;
  showRewayatInfo: (
    rewayat: RewayatStyle[],
    selectedId?: string,
    onSelect?: (id: string) => void,
  ) => void;
  showFavoriteReciters: () => void;
  showSelectReciter: (surahId: string, source?: 'search' | 'home') => void;
  showPlaylistContextMenu: (
    playlistId: string,
    playlistName: string,
    onDelete: () => void,
    onEdit?: () => void,
    playlistColor?: string,
  ) => void;
  showEditPlaylist: (
    playlistId: string,
    playlistName: string,
    playlistColor: string,
    onSave: (name: string, color: string) => void,
  ) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: React.ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({children}) => {
  const surahOptionsRef = useRef<BottomSheet>(null);
  const rewayatInfoRef = useRef<BottomSheet>(null);
  const favoriteRecitersRef = useRef<BottomSheet>(null);
  const selectReciterRef = useRef<BottomSheet>(null);
  const playlistContextMenuRef = useRef<BottomSheet>(null);
  const editPlaylistModalRef = useRef<BottomSheet>(null);

  const [currentSurah, setCurrentSurah] = useState<Surah | null>(null);
  const [currentReciterId, setCurrentReciterId] = useState<
    string | undefined
  >();
  const [currentRewayatId, setCurrentRewayatId] = useState<
    string | undefined
  >();

  const [rewayatInfo, setRewayatInfo] = useState<{
    rewayat: RewayatStyle[];
    selectedId?: string;
    onSelect?: (id: string) => void;
  } | null>(null);

  const [selectReciterParams, setSelectReciterParams] = useState<{
    surahId: string;
    source?: 'search' | 'home';
  } | null>(null);

  const [queueHandler, setQueueHandler] = useState<
    ((surah: Surah) => Promise<void>) | undefined
  >();

  const [playlistContextMenuParams, setPlaylistContextMenuParams] = useState<{
    playlistId: string;
    playlistName: string;
    playlistColor?: string;
    onDelete: () => void;
    onEdit?: () => void;
  } | null>(null);

  const [, setEditPlaylistParams] = useState<{
    playlistId: string;
    playlistName: string;
    playlistColor: string;
    onSave: (name: string, color: string) => void;
  } | null>(null);

  const showSurahOptions = useCallback(
    (
      surah: Surah,
      reciterId?: string,
      onAddToQueue?: (surah: Surah) => Promise<void>,
      rewayatId?: string,
    ) => {
      setCurrentSurah(surah);
      setCurrentReciterId(reciterId);
      setCurrentRewayatId(rewayatId);
      setQueueHandler(() => onAddToQueue);
      // No manual expand() needed - the component will mount with index={0}
    },
    [],
  );

  const showRewayatInfo = useCallback(
    (
      rewayat: RewayatStyle[],
      selectedId?: string,
      onSelect?: (id: string) => void,
    ) => {
      setRewayatInfo({rewayat, selectedId, onSelect});
    },
    [],
  );

  const showFavoriteReciters = useCallback(() => {
    requestAnimationFrame(() => {
      favoriteRecitersRef.current?.expand();
    });
  }, []);

  const showSelectReciter = useCallback(
    (surahId: string, source?: 'search' | 'home') => {
      setSelectReciterParams({surahId, source});
    },
    [],
  );

  const showPlaylistContextMenu = useCallback(
    (
      playlistId: string,
      playlistName: string,
      onDelete: () => void,
      onEdit?: () => void,
      playlistColor?: string,
    ) => {
      setPlaylistContextMenuParams({
        playlistId,
        playlistName,
        playlistColor,
        onDelete,
        onEdit,
      });
    },
    [],
  );

  const showEditPlaylist = useCallback(
    (
      playlistId: string,
      playlistName: string,
      playlistColor: string,
      onSave: (name: string, color: string) => void,
    ) => {
      setEditPlaylistParams({
        playlistId,
        playlistName,
        playlistColor,
        onSave,
      });
      requestAnimationFrame(() => {
        setTimeout(() => {
          editPlaylistModalRef.current?.expand();
        }, 50);
      });
    },
    [],
  );

  const handleCloseSurahOptions = useCallback(() => {
    setCurrentSurah(null);
    setCurrentReciterId(undefined);
    setCurrentRewayatId(undefined);
    setQueueHandler(undefined);
  }, []);

  const handleCloseRewayatInfo = useCallback(() => {
    setRewayatInfo(null);
  }, []);

  const handleCloseFavoriteReciters = useCallback(() => {
    favoriteRecitersRef.current?.close();
  }, []);

  const handleCloseSelectReciter = useCallback(() => {
    setSelectReciterParams(null);
  }, []);

  const handleClosePlaylistContextMenu = useCallback(() => {
    setPlaylistContextMenuParams(null);
  }, []);

  return (
    <ModalContext.Provider
      value={{
        showSurahOptions,
        showRewayatInfo,
        showFavoriteReciters,
        showSelectReciter,
        showPlaylistContextMenu,
        showEditPlaylist,
      }}>
      <View style={StyleSheet.absoluteFill}>{children}</View>
      <View style={styles.modalContainer}>
        {currentSurah && (
          <SurahOptionsModal
            bottomSheetRef={surahOptionsRef}
            surah={currentSurah}
            reciterId={currentReciterId}
            rewayatId={currentRewayatId}
            onClose={handleCloseSurahOptions}
            onAddToQueue={queueHandler}
          />
        )}
        {rewayatInfo && (
          <RewayatInfoModal
            bottomSheetRef={rewayatInfoRef}
            availableRewayat={rewayatInfo.rewayat}
            selectedRewayatId={rewayatInfo.selectedId}
            onRewayatSelect={id => {
              rewayatInfo.onSelect?.(id);
              handleCloseRewayatInfo();
            }}
            onClose={handleCloseRewayatInfo}
          />
        )}
        <FavoriteRecitersModal
          bottomSheetRef={favoriteRecitersRef}
          onClose={handleCloseFavoriteReciters}
        />
        {selectReciterParams && (
          <SelectReciterModal
            bottomSheetRef={selectReciterRef}
            onClose={handleCloseSelectReciter}
            surahId={selectReciterParams.surahId}
            source={selectReciterParams.source}
          />
        )}
        {playlistContextMenuParams && (
          <PlaylistContextMenu
            bottomSheetRef={playlistContextMenuRef}
            playlistId={playlistContextMenuParams.playlistId}
            playlistName={playlistContextMenuParams.playlistName}
            playlistColor={playlistContextMenuParams.playlistColor}
            onDelete={() => {
              playlistContextMenuParams.onDelete();
              handleClosePlaylistContextMenu();
            }}
            onEdit={() => {
              playlistContextMenuParams.onEdit?.();
              setTimeout(() => {
                handleClosePlaylistContextMenu();
              }, 100);
            }}
            onClose={handleClosePlaylistContextMenu}
          />
        )}
      </View>
    </ModalContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'box-none',
  },
});
