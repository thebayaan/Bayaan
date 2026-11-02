// @ai-generated
import {useMemo} from 'react';
import {useIsFocused} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useKeyCommands} from '@/hooks/useKeyCommands';
import type {KeyBinding} from '@/services/keyboard/keyCommands';
import {toggleRecitation} from '@/services/keyboard/keyActions';

const TOTAL_PAGES = 604;

interface Props {
  currentPage: number;
  /** 2 when the reader shows two-page spreads. */
  pageStep: 1 | 2;
  /** False while something covers the pages, such as search. */
  canTurnPage: boolean;
  turnTo: (page: number) => void;
  openSearch: () => void;
  /** Closes the topmost overlay, then search, then immersive mode. */
  onEscape: () => void;
}

/**
 * The reader's keyboard shortcuts (reading standards §6). While the reader
 * is in front they override the app-wide Space and ← / →: Space and ⇧Space
 * turn pages, ← / → turn them in mushaf direction (the next page lies to
 * the left), ⌥Space plays or pauses the recitation. The full player opened
 * over the reader takes the keys back.
 */
export function ReaderKeyCommands({
  currentPage,
  pageStep,
  canTurnPage,
  turnTo,
  openSearch,
  onEscape,
}: Props): null {
  const {t} = useTranslation('common');
  const onScreen = useIsFocused();
  const playerOpen = usePlayerStore(s => s.sheetMode === 'full');

  const bindings = useMemo<KeyBinding[]>(() => {
    const turn = (direction: 1 | -1) => {
      const page = Math.min(
        TOTAL_PAGES,
        Math.max(1, currentPage + direction * pageStep),
      );
      if (page !== currentPage) turnTo(page);
    };
    const next = t('keyboard.nextPage');
    const previous = t('keyboard.previousPage');
    return [
      {
        key: 'space',
        title: next,
        menu: 'reader',
        enabled: canTurnPage,
        run: () => turn(1),
      },
      {
        key: 'shift-space',
        title: previous,
        menu: 'reader',
        enabled: canTurnPage,
        run: () => turn(-1),
      },
      {
        key: 'option-space',
        title: t('keyboard.playPauseRecitation'),
        menu: 'reader',
        run: () => toggleRecitation(currentPage),
      },
      {
        key: 'left',
        title: next,
        menu: 'reader',
        enabled: canTurnPage,
        run: () => turn(1),
      },
      {
        key: 'right',
        title: previous,
        menu: 'reader',
        enabled: canTurnPage,
        run: () => turn(-1),
      },
      {
        key: 'cmd-f',
        title: t('keyboard.search'),
        menu: 'reader',
        run: openSearch,
      },
      {
        key: 'escape',
        title: t('keyboard.close'),
        menu: 'reader',
        run: onEscape,
      },
    ];
  }, [t, currentPage, pageStep, canTurnPage, turnTo, openSearch, onEscape]);

  useKeyCommands(bindings, onScreen && !playerOpen);
  return null;
}
