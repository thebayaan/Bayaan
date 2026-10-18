import React, {useEffect, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {SidePanel} from '../listening/SidePanel';
import {
  reciterChoicesForSurah,
  rewayahLabel,
} from '../../services/listeningChoices';
import {getReciterArtwork} from '../../services/reciterArtwork';
import {pushScreenBack} from '../../services/screenBack';
import {surahTitle} from '../../services/playbackRouting';
import {setTVMenuKeyEnabled} from '../../hooks/tvMenuKey';
import {useNavStore} from '../../store/navStore';
import {useContextMenuStore} from '../../store/contextMenuStore';
import {colors} from '../../theme/colors';
import type {Reciter, Rewayah} from '../../types/reciter';

/** How many voices the picker lists (the player's Reciter panel shows as many). */
const CHOICES = 40;

type Props = {
  surahNumber: number;
  reciters: readonly Reciter[];
  /** The voice the hero would play in, marked as selected. */
  currentId: string | null;
  preferredIds: readonly string[];
  onPick: (reciter: Reciter, rewayah: Rewayah) => void;
  onClose: () => void;
};

/**
 * The hero's "Another reciter": the reciters who recite its surah, your
 * favourites and default first, in the player's side panel over Home.
 * Picking one plays the surah with them; Back closes the panel and focus
 * returns to the button that opened it.
 */
export function HeroReciterPicker({
  surahNumber,
  reciters,
  currentId,
  preferredIds,
  onPick,
  onClose,
}: Props): React.ReactElement {
  const choices = useMemo(
    () =>
      reciterChoicesForSurah(reciters, surahNumber, {
        currentId,
        preferredIds,
        limit: CHOICES,
      }),
    [reciters, surahNumber, currentId, preferredIds],
  );

  // Back closes the panel. Home is a root place, where the tvOS Menu key
  // normally leaves the app, so it is routed to the app while the panel is
  // open and handed back when it closes (unless a screen now needs it).
  useEffect(() => {
    const remove = pushScreenBack(() => {
      onClose();
      return true;
    });
    setTVMenuKeyEnabled(true);
    return () => {
      remove();
      const nav = useNavStore.getState();
      const stillNeeded =
        nav.stack.length > 0 ||
        nav.currentTab !== 'home' ||
        useContextMenuStore.getState().target !== null;
      if (!stillNeeded) setTVMenuKeyEnabled(false);
    };
  }, [onClose]);

  return (
    <View style={styles.scrim}>
      <SidePanel
        title={surahTitle(surahNumber)}
        onActivity={noop}
        sections={[
          {
            title: 'Recite it with',
            options: choices.map(c => ({
              value: c.reciter.id,
              label: c.reciter.name,
              detail: rewayahLabel(c.rewayah),
              face: {
                source: getReciterArtwork(c.reciter),
                name: c.reciter.name,
              },
            })),
            selected: currentId,
            onSelect: (id: string) => {
              const choice = choices.find(c => c.reciter.id === id);
              if (choice) onPick(choice.reciter, choice.rewayah);
            },
          },
        ]}
      />
    </View>
  );
}

function noop(): void {}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
});
