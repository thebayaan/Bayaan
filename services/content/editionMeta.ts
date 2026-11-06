import type {ContentMeta} from '@/types/content';
import {contentLanguageName} from './contentLanguage';

/** The display metadata both edition databases store with their rows. */
export interface EditionMeta {
  name: string;
  englishName: string;
  language: string;
  direction: 'ltr' | 'rtl';
}

/**
 * Resolves what an install writes: the manifest meta first, then each
 * fallback in order (the installed row, a bundled catalog entry), then
 * defaults. The manifest's single name serves as the English name too.
 */
export function resolveEditionMeta(
  meta: ContentMeta | undefined,
  fallbacks: ReadonlyArray<Partial<EditionMeta> | undefined>,
  defaultName: string,
): EditionMeta {
  const first = <K extends keyof EditionMeta>(field: K) =>
    fallbacks.find(item => item?.[field] !== undefined)?.[field];
  const name = meta?.name ?? first('name') ?? defaultName;
  return {
    name,
    englishName: meta?.name ?? first('englishName') ?? name,
    language:
      contentLanguageName(meta?.language) ?? first('language') ?? 'English',
    direction: meta?.direction ?? first('direction') ?? 'ltr',
  };
}
