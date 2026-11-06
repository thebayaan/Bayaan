// @ai-generated
import {createContext, useContext, type ComponentType} from 'react';
import type {Surah} from '@/data/surahData';
import type {SurahOptionsPayload} from './surahOptions';
import type {OptionsMenuProps} from './OptionsMenu';

/** What a row knows about itself beyond its surah. */
export interface SurahRowInfo {
  reciterId?: string;
  rewayatId?: string;
  userRecitationId?: string;
}

/** Builds the options payload for one row. */
export type SurahOptionsBuilder = (
  surah: Surah,
  row?: SurahRowInfo,
) => SurahOptionsPayload | null;

export interface SurahOptionsContextValue {
  build: SurahOptionsBuilder;
  /** The menu component, supplied by the provider so rows stay light. */
  Menu: ComponentType<OptionsMenuProps & {payload: SurahOptionsPayload | null}>;
}

/**
 * Screens that open the surah options provide this (see `surahOptions.tsx`),
 * so a row's ••• can open a native menu on tablets without every list
 * passing payloads down. Rows import only this file; the menu and its store
 * hooks come in with the screen.
 */
export const SurahOptionsContext =
  createContext<SurahOptionsContextValue | null>(null);

export function useSurahOptionsContext(): SurahOptionsContextValue | null {
  return useContext(SurahOptionsContext);
}
