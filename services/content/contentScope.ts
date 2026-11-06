import branding from '@/config/branding';
import type {ContentKind} from '@/types/content';
import {resolveContentApiBase} from './contentApi';

// Kept apart from contentSync so a store (the settings migration) can ask
// which kinds the engine owns without loading the engine and its stores.

/**
 * The single gate for every caller: the kinds this engine owns. Empty without
 * an API base URL, or when a fork keeps its own tafsirProvider: the cycle is
 * anchored on tafsir (adoption, first-launch install), so the engine only runs
 * while it owns tafsir. Translations ride along unless a fork keeps its own
 * translationProvider (RFC-009).
 */
export function managedKinds(): ContentKind[] {
  if (branding.tafsirProvider || resolveContentApiBase() === null) return [];
  return branding.translationProvider ? ['tafsir'] : ['tafsir', 'translation'];
}

// When false, initContentSync, installContent and removeContent must not be called.
export function isEngineManagingTafsir(): boolean {
  return managedKinds().includes('tafsir');
}

export function isEngineManagingTranslations(): boolean {
  return managedKinds().includes('translation');
}
