// @ai-generated
import React from 'react';
import {useRouter} from 'expo-router';
import TranslationsContent from '@/components/screens/TranslationsContent';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';
import {TabletDialog} from '@/components/layout/TabletDialog';
import {SHEET_MAX_HEIGHT} from '@/components/sheets/AdaptiveActionSheet';
import {useResponsive} from '@/hooks/useResponsive';

/**
 * Translations and tafaseer picker opened from the reader and the verse
 * sheet. It lives in the root stack so it opens on top of the Mushaf (or
 * whatever screen is showing) and Back returns there, instead of switching
 * to a tab. Settings keeps its own copy at (d.settings)/translations.
 *
 * On iPad the root stack presents it as a transparent modal, drawn as a
 * centered card with its own header instead of a full page.
 */
export default function TranslationsScreen() {
  const {isTablet} = useResponsive();
  const router = useRouter();

  if (isTablet) {
    return (
      <TabletDialog onClose={router.back} height={SHEET_MAX_HEIGHT}>
        <TranslationsContent onClose={router.back} />
      </TabletDialog>
    );
  }

  return (
    <MaxWidthContainer>
      <TranslationsContent />
    </MaxWidthContainer>
  );
}
