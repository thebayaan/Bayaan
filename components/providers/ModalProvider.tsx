import React, {createContext, useContext, useCallback} from 'react';
import {View, StyleSheet} from 'react-native';
import {useRef} from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import {Surah} from '@/data/surahData';
import {SurahOptionsModal} from '@/components/SurahOptionsModal';
import {RewayatInfoModal} from '@/components/modals/RewayatInfoModal';
import type {RewayatStyle} from '@/types/reciter';

interface ModalContextType {
  showSurahOptions: (surah: Surah, reciterId?: string) => void;
  showRewayatInfo: (
    rewayat: RewayatStyle[],
    selectedId?: string,
    onSelect?: (id: string) => void,
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

  const [currentSurah, setCurrentSurah] = React.useState<Surah | null>(null);
  const [currentReciterId, setCurrentReciterId] = React.useState<
    string | undefined
  >();

  const [rewayatInfo, setRewayatInfo] = React.useState<{
    rewayat: RewayatStyle[];
    selectedId?: string;
    onSelect?: (id: string) => void;
  } | null>(null);

  const showSurahOptions = useCallback((surah: Surah, reciterId?: string) => {
    setCurrentSurah(surah);
    setCurrentReciterId(reciterId);
    surahOptionsRef.current?.expand();
  }, []);

  const showRewayatInfo = useCallback(
    (
      rewayat: RewayatStyle[],
      selectedId?: string,
      onSelect?: (id: string) => void,
    ) => {
      setRewayatInfo({rewayat, selectedId, onSelect});
      rewayatInfoRef.current?.expand();
    },
    [],
  );

  const handleCloseSurahOptions = useCallback(() => {
    surahOptionsRef.current?.close();
    setCurrentSurah(null);
    setCurrentReciterId(undefined);
  }, []);

  const handleCloseRewayatInfo = useCallback(() => {
    rewayatInfoRef.current?.close();
    setRewayatInfo(null);
  }, []);

  return (
    <ModalContext.Provider value={{showSurahOptions, showRewayatInfo}}>
      <View style={StyleSheet.absoluteFill}>{children}</View>
      <View style={styles.modalContainer}>
        {currentSurah && (
          <SurahOptionsModal
            bottomSheetRef={surahOptionsRef}
            surah={currentSurah}
            reciterId={currentReciterId}
            onClose={handleCloseSurahOptions}
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
