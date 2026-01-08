import React, {createContext, useContext, useCallback} from 'react';
import {View, StyleSheet} from 'react-native';
import {useRef} from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import {Surah} from '@/data/surahData';
import {SurahOptionsModal} from '@/components/modals/SurahOptionsModal';
import {RewayatInfoModal} from '@/components/modals/RewayatInfoModal';
import {FavoriteRecitersModal} from '@/components/modals/FavoriteRecitersModal';
import {AddReciterModal} from '@/components/modals/AddReciterModal';
import {AddReciterMenuModal} from '@/components/modals/AddReciterMenuModal';
import {BulkUploadModal} from '@/components/modals/BulkUploadModal';
import {SelectReciterModal} from '@/components/modals/SelectReciterModal';
import {PlaylistContextMenu} from '@/components/modals/PlaylistContextMenu';
import {useAllReciters} from '@/hooks/useAllReciters';
import {RewayatStyle} from '@/types/reciter';

interface ModalContextType {
  showSurahOptions: (
    surah: Surah,
    reciterId?: string,
    onAddToQueue?: (surah: Surah) => Promise<void>,
    rewayatId?: string,
    onUpdateAudio?: (surah: Surah) => Promise<void>,
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
  showAddReciterMenu: (onAddReciter: () => void) => void;
  showAddReciterModal: () => void;
  showBulkUpload: (reciterId: string, onSuccess?: () => void) => void;
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
  const addReciterMenuRef = useRef<BottomSheet>(null);
  const bulkUploadModalRef = useRef<BottomSheet>(null);
  
  // State for AddReciterModal visibility
  const [isAddReciterModalVisible, setIsAddReciterModalVisible] = React.useState(false);

  const [currentSurah, setCurrentSurah] = React.useState<Surah | null>(null);
  const [currentReciterId, setCurrentReciterId] = React.useState<
    string | undefined
  >();
  const [currentRewayatId, setCurrentRewayatId] = React.useState<
    string | undefined
  >();

  const [rewayatInfo, setRewayatInfo] = React.useState<{
    rewayat: RewayatStyle[];
    selectedId?: string;
    onSelect?: (id: string) => void;
  } | null>(null);

  const [selectReciterParams, setSelectReciterParams] = React.useState<{
    surahId: string;
    source?: 'search' | 'home';
  } | null>(null);

  const [queueHandler, setQueueHandler] = React.useState<
    ((surah: Surah) => Promise<void>) | undefined
  >();
  const [onUpdateAudioHandler, setOnUpdateAudioHandler] = React.useState<
    ((surah: Surah) => Promise<void>) | undefined
  >();

  const [playlistContextMenuParams, setPlaylistContextMenuParams] =
    React.useState<{
      playlistId: string;
      playlistName: string;
      playlistColor?: string;
      onDelete: () => void;
      onEdit?: () => void;
    } | null>(null);

  const [, setEditPlaylistParams] = React.useState<{
    playlistId: string;
    playlistName: string;
    playlistColor: string;
    onSave: (name: string, color: string) => void;
  } | null>(null);
  
  // Store the callback for adding reciter
  const [onAddReciterCallback, setOnAddReciterCallback] = React.useState<(() => void) | null>(null);
  const [bulkUploadReciterId, setBulkUploadReciterId] =
    React.useState<string | null>(null);
  const [onBulkUploadSuccess, setOnBulkUploadSuccess] =
    React.useState<(() => void) | null>(null);

  const {getReciterById} = useAllReciters();
  const currentReciter = currentReciterId ? getReciterById(currentReciterId) : undefined;

  const showSurahOptions = useCallback(
    (
      surah: Surah,
      reciterId?: string,
      onAddToQueue?: (surah: Surah) => Promise<void>,
      rewayatId?: string,
      onUpdateAudio?: (surah: Surah) => Promise<void>,
    ) => {
      setCurrentSurah(surah);
      setCurrentReciterId(reciterId);
      setCurrentRewayatId(rewayatId);
      setQueueHandler(() => onAddToQueue);
      setOnUpdateAudioHandler(() => onUpdateAudio);
      setTimeout(() => {
        surahOptionsRef.current?.expand();
      }, 50);
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
      setTimeout(() => {
        rewayatInfoRef.current?.expand();
      }, 50);
    },
    [],
  );

  const showFavoriteReciters = useCallback(() => {
    setTimeout(() => {
      favoriteRecitersRef.current?.expand();
    }, 50);
  }, []);

  const showSelectReciter = useCallback(
    (surahId: string, source?: 'search' | 'home') => {
      setSelectReciterParams({surahId, source});
      setTimeout(() => {
        if (selectReciterRef.current) {
          selectReciterRef.current.expand();
        } else {
          console.warn('Select reciter modal ref is not available');
          setTimeout(() => {
            selectReciterRef.current?.expand();
          }, 100);
        }
      }, 150);
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
      setTimeout(() => {
        playlistContextMenuRef.current?.expand();
      }, 50);
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
      // Open immediately for smooth transition
      requestAnimationFrame(() => {
        setTimeout(() => {
          editPlaylistModalRef.current?.expand();
        }, 50);
      });
    },
    [],
  );

  const showAddReciterMenu = useCallback((onAddReciter: () => void) => {
    setOnAddReciterCallback(() => onAddReciter);
    setTimeout(() => {
      addReciterMenuRef.current?.expand();
    }, 50);
  }, []);

  const showAddReciterModal = useCallback(() => {
    setIsAddReciterModalVisible(true);
  }, []);

  const showBulkUpload = useCallback((reciterId: string, onSuccess?: () => void) => {
    setBulkUploadReciterId(reciterId);
    setOnBulkUploadSuccess(() => onSuccess || null);
    setTimeout(() => {
      bulkUploadModalRef.current?.expand();
    }, 50);
  }, []);

  const handleCloseSurahOptions = useCallback(() => {
    surahOptionsRef.current?.close();
    setCurrentSurah(null);
    setCurrentReciterId(undefined);
    setCurrentRewayatId(undefined);
    setQueueHandler(undefined);
    setOnUpdateAudioHandler(undefined);
  }, []);

  const handleCloseRewayatInfo = useCallback(() => {
    rewayatInfoRef.current?.close();
  }, []);

  const handleCloseFavoriteReciters = useCallback(() => {
    favoriteRecitersRef.current?.close();
  }, []);

  const handleCloseSelectReciter = useCallback(() => {
    selectReciterRef.current?.close();
    setSelectReciterParams(null);
  }, []);

  const handleClosePlaylistContextMenu = useCallback(() => {
    playlistContextMenuRef.current?.close();
    setPlaylistContextMenuParams(null);
  }, []);
  
  const handleCloseAddReciterMenu = useCallback(() => {
    addReciterMenuRef.current?.close();
  }, []);
  
  const handleCloseAddReciterModal = useCallback(() => {
    setIsAddReciterModalVisible(false);
  }, []);

  const handleCloseBulkUpload = useCallback(() => {
    bulkUploadModalRef.current?.close();
    setBulkUploadReciterId(null);
    setOnBulkUploadSuccess(null);
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
        showAddReciterMenu,
        showAddReciterModal,
        showBulkUpload,
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
            onUpdateAudio={onUpdateAudioHandler}
            isLocal={currentReciter?.isLocal}
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
              // Call the edit handler first
              playlistContextMenuParams.onEdit?.();
              // Close context menu after a short delay to allow edit modal to start opening
              setTimeout(() => {
                handleClosePlaylistContextMenu();
              }, 100);
            }}
            onClose={handleClosePlaylistContextMenu}
          />
        )}
        
        <AddReciterMenuModal
          bottomSheetRef={addReciterMenuRef}
          onClose={handleCloseAddReciterMenu}
          onAddReciter={() => {
             // If a callback was provided via showAddReciterMenu, call it
             // Otherwise fallback to opening the global modal
             if (onAddReciterCallback) {
                onAddReciterCallback();
             } else {
                showAddReciterModal();
             }
          }}
        />
        
        <AddReciterModal
          visible={isAddReciterModalVisible}
          onClose={handleCloseAddReciterModal}
        />
        {bulkUploadReciterId && (
          <BulkUploadModal
            bottomSheetRef={bulkUploadModalRef}
            reciterId={bulkUploadReciterId}
            onClose={handleCloseBulkUpload}
            onSuccess={() => {
              onBulkUploadSuccess?.();
              handleCloseBulkUpload();
            }}
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
