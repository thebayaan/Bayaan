// @ai-generated
import React, {useCallback, useState, type ReactElement} from 'react';
import {useWindowDimensions} from 'react-native';
import {NativePopover} from '@/components/native/NativePopover';
import {useNativePopover} from '@/components/native/useNativePopover';
import {
  AmbientSoundsPanel,
  stopAmbientSampling,
} from '@/components/sheets/AmbientSoundsPanel';
import {
  MushafLayoutPanel,
  type MushafLayoutContext,
} from '@/components/sheets/MushafLayoutPanel';

const AMBIENT_WIDTH = 380;
const READING_SETTINGS_WIDTH = 400;

interface ToolPopoverProps {
  /** Opens the sheet where there are no popovers (Android, phones). */
  onFallbackPress: () => void;
  /** Renders the tool button with the press handler to give it. */
  children: (onPress: () => void) => ReactElement;
}

/**
 * Ambient sounds as a popover anchored to the player's ambient button on
 * iPad. Closing it stops a sound the listener was only sampling, as the
 * sheet does.
 */
export function AmbientPopover({onFallbackPress, children}: ToolPopoverProps) {
  const enabled = useNativePopover();
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const dismiss = useCallback(() => {
    setOpen(false);
    stopAmbientSampling();
  }, []);
  if (!enabled) return children(onFallbackPress);
  return (
    <NativePopover
      isPresented={open}
      onDismiss={dismiss}
      contentWidth={AMBIENT_WIDTH}
      content={<AmbientSoundsPanel />}>
      {children(show)}
    </NativePopover>
  );
}

/**
 * Reading settings (Aa) as a popover anchored to its button on iPad. The
 * settings scroll, so the popover takes a fixed share of the window height.
 */
export function ReadingSettingsPopover({
  context,
  onFallbackPress,
  children,
}: ToolPopoverProps & {context: MushafLayoutContext}) {
  const enabled = useNativePopover();
  const {height} = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const dismiss = useCallback(() => setOpen(false), []);
  if (!enabled) return children(onFallbackPress);
  return (
    <NativePopover
      isPresented={open}
      onDismiss={dismiss}
      contentWidth={READING_SETTINGS_WIDTH}
      contentHeight={Math.round(height * 0.7)}
      content={
        open ? (
          <MushafLayoutPanel context={context} onClose={dismiss} /> // @ai
        ) : null
      }>
      {children(show)}
    </NativePopover>
  );
}
