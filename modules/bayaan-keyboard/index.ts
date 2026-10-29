// @ai-generated
import {requireOptionalNativeModule} from 'expo';
import type {EventSubscription} from 'expo-modules-core';

interface NativeEvents {
  onKeyCommand: (event: {id: string}) => void;
}

// Every member is optional: a build made before this module existed has no
// native side, so each call is guarded at runtime.
interface BayaanKeyboardNative {
  setCommands?: (json: string) => void;
  addListener?: <K extends keyof NativeEvents>(
    name: K,
    fn: NativeEvents[K],
  ) => EventSubscription;
}

const native =
  requireOptionalNativeModule<BayaanKeyboardNative>('BayaanKeyboard');

/** A menu the shortcuts are listed under, in the menu bar and ⌘-hold list. */
export interface NativeKeyMenu {
  id: string;
  title: string;
}

/** One shortcut as the native side builds it. */
export interface NativeKeyCommand {
  id: string;
  title: string;
  /** A character, or 'space', 'left', 'right', 'up', 'down', 'escape'. */
  input: string;
  modifiers: ('command' | 'shift' | 'alternate' | 'control')[];
  menu: string;
  enabled: boolean;
  repeatable: boolean;
}

export const BayaanKeyboard = {
  isAvailable:
    native !== null &&
    typeof native.setCommands === 'function' &&
    typeof native.addListener === 'function',

  setCommands(menus: NativeKeyMenu[], commands: NativeKeyCommand[]): void {
    if (typeof native?.setCommands !== 'function') return;
    native.setCommands(JSON.stringify({menus, commands}));
  },

  addKeyCommandListener(fn: (id: string) => void): () => void {
    if (typeof native?.addListener !== 'function') return () => undefined;
    const sub = native.addListener('onKeyCommand', event => fn(event.id));
    return () => sub.remove();
  },
};
