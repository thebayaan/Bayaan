// @ai-generated
import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {TabletPlayerReciterColumn} from '@/components/tablet/TabletPlayerReciterColumn';
import {QuranView} from '../PlayerContent/QuranView';
import {UploadPlaceholder} from '../PlayerContent/UploadPlaceholder';
import type {PlayerPane} from './PlayerParts';
import {QueuePane} from './QueuePane';
import {READING_COLUMN_MAX} from './playerMetrics';

// Verse taps do nothing here: the controls sit beside or below the text,
// never over it, so there is nothing to hide.
const ignoreVersePress = () => {
  // intentionally empty
};

interface PlayerPaneBodyProps {
  pane: PlayerPane;
  /** Width of the region the pane fills; QuranView centers its column in it. */
  width: number;
  /** Space kept clear at the bottom: the safe area, plus the transport card when it floats over the pane. */
  bottomInset: number;
}

/**
 * The switchable region of the iPad player: the verses (Text), the queue
 * (Queue) or the reciter's catalog (Reciters), each held to the 680pt
 * reading column.
 */
export function PlayerPaneBody({
  pane,
  width,
  bottomInset,
}: PlayerPaneBodyProps) {
  const currentTrack = usePlayerStore(
    s => s.queue.tracks?.[s.queue.currentIndex ?? -1],
  );

  const showTranslation = useMushafSettingsStore(s => s.showTranslation);
  const showTransliteration = useMushafSettingsStore(
    s => s.showTransliteration,
  );
  const arabicFontSize = useMushafSettingsStore(s => s.arabicFontSize);
  const translationFontSize = useMushafSettingsStore(
    s => s.translationFontSize,
  );
  const transliterationFontSize = useMushafSettingsStore(
    s => s.transliterationFontSize,
  );

  const currentSurah = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const isUntaggedUpload = currentTrack?.isUserUpload && !currentTrack?.surahId;

  useEffect(() => {
    useVerseSelectionStore.getState().clearSelection();
  }, [currentSurah]);

  if (pane === 'queue') {
    return (
      <View style={styles.column}>
        <QueuePane bottomInset={bottomInset} />
      </View>
    );
  }

  if (pane === 'reciters' && currentTrack?.reciterId) {
    return (
      <View style={styles.column}>
        <TabletPlayerReciterColumn
          key={currentTrack.reciterId}
          embedded
          reciterId={currentTrack.reciterId}
          initialRewayatId={currentTrack.rewayatId}
          bottomInset={bottomInset}
        />
      </View>
    );
  }

  if (isUntaggedUpload) {
    return (
      <View style={[styles.fill, {paddingBottom: bottomInset}]}>
        <UploadPlaceholder currentTrack={currentTrack} />
      </View>
    );
  }

  return (
    <QuranView
      currentSurah={currentSurah ?? 1}
      onVersePress={ignoreVersePress}
      showTranslation={showTranslation}
      showTransliteration={showTransliteration}
      transliterationFontSize={transliterationFontSize}
      translationFontSize={translationFontSize}
      arabicFontSize={arabicFontSize}
      contentPaddingTop={12}
      contentPaddingBottom={bottomInset}
      parentContentWidth={width}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: READING_COLUMN_MAX,
    alignSelf: 'center',
  },
});
