// @ai-generated
import React from 'react';
import {Modal} from 'react-native';
import TranslationsContent from '@/components/screens/TranslationsContent';
import {TabletDialog} from '@/components/layout/TabletDialog';
import {SHEET_MAX_HEIGHT} from '@/components/sheets/AdaptiveActionSheet';

/** The verse card turns with the iPad, so the dialog over it does too. */
const SUPPORTED_ORIENTATIONS = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
] as const;

interface TranslationsDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * The translations and tafaseer picker, opened from the verse card's gear on
 * iPad. It opens over the card instead of replacing it, so closing it leaves
 * the card on the Translation or Tafsir screen the reader was on, showing the
 * edition they picked. Phones go to the /translations page instead.
 */
export function TranslationsDialog({
  visible,
  onClose,
}: TranslationsDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={[...SUPPORTED_ORIENTATIONS]}
      onRequestClose={onClose}>
      <TabletDialog onClose={onClose} height={SHEET_MAX_HEIGHT}>
        <TranslationsContent onClose={onClose} />
      </TabletDialog>
    </Modal>
  );
}
