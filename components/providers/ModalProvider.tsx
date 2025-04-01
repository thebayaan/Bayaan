import React, {createContext, useContext, useCallback} from 'react';
import {View, StyleSheet} from 'react-native';
import {useRef} from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import {Surah} from '@/data/surahData';
import {SurahOptionsModal} from '@/components/modals/SurahOptionsModal';
import {RewayatInfoModal} from '@/components/modals/RewayatInfoModal';
import {FavoriteRecitersModal} from '@/components/modals/FavoriteRecitersModal';
import {SelectReciterModal} from '@/components/modals/SelectReciterModal';
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

  const handleCloseSurahOptions = useCallback(() => {
    surahOptionsRef.current?.close();
    setCurrentSurah(null);
    setCurrentReciterId(undefined);
    setCurrentRewayatId(undefined);
    setQueueHandler(undefined);
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

  return (
    <ModalContext.Provider
      value={{
        showSurahOptions,
        showRewayatInfo,
        showFavoriteReciters,
        showSelectReciter,
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
