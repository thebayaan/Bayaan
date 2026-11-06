import type {ContentKind} from '@/types/content';

// The one place that knows how a content key encodes its kind and id:
// `qf:<group>:<id>`, for example qf:translations:20 or qf:tafsirs:169.
export const KEY_PREFIX: Readonly<Record<ContentKind, string>> = {
  tafsir: 'qf:tafsirs:',
  translation: 'qf:translations:',
};

const KINDS = Object.keys(KEY_PREFIX) as ContentKind[];

export function kindForKey(key: string): ContentKind | null {
  return KINDS.find(kind => key.startsWith(KEY_PREFIX[kind])) ?? null;
}

// The edition id the local databases store (the bare QF id).
export function idFromKey(key: string): string {
  const kind = kindForKey(key);
  return kind
    ? key.slice(KEY_PREFIX[kind].length)
    : key.slice(key.lastIndexOf(':') + 1);
}

export function keyFor(kind: ContentKind, id: string): string {
  return KEY_PREFIX[kind] + id;
}
