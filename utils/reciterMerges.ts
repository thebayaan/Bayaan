// @ai-generated
import type {Reciter} from '@/data/reciterData';

/**
 * A reciter the backend catalog lists twice. The `from` row is folded into
 * the `to` reciter: its recitations move over, and anything saved on the
 * device under the `from` id is moved to the `to` id.
 */
export interface ReciterMerge {
  fromId: string;
  fromSlug: string;
  fromName: string;
  toId: string;
  toSlug: string;
  toName: string;
}

export const RECITER_MERGES: readonly ReciterMerge[] = [
  // Same reciter imported twice: the hadr recitation came in as a separate
  // "Yaser Salamah" next to the murattal "Yasser Salamah".
  {
    fromId: '37761060-bd83-4b46-8fec-e71627eb0531',
    fromSlug: 'yaser-salamah',
    fromName: 'Yaser Salamah',
    toId: 'b5312425-cc6b-4e53-b862-5b389c5dea94',
    toSlug: 'yasser-salamah',
    toName: 'Yasser Salamah',
  },
];

/** The id a reciter is listed under after merges. */
export function canonicalReciterId(
  id: string,
  merges: readonly ReciterMerge[] = RECITER_MERGES,
): string {
  return merges.find(m => m.fromId === id)?.toId ?? id;
}

/** The slug a reciter is listed under after merges. */
export function canonicalReciterSlug(
  slug: string,
  merges: readonly ReciterMerge[] = RECITER_MERGES,
): string {
  return merges.find(m => m.fromSlug === slug)?.toSlug ?? slug;
}

/**
 * Folds each merged reciter into the one it belongs to, so the catalog lists
 * it once with all its recitations. A `from` row whose `to` reciter is
 * missing is kept as it is. Returns the same array when nothing changes.
 */
export function foldMergedReciters(
  reciters: Reciter[],
  merges: readonly ReciterMerge[] = RECITER_MERGES,
): Reciter[] {
  const ids = new Set(reciters.map(r => r.id));
  const active = merges.filter(m => ids.has(m.fromId) && ids.has(m.toId));
  if (active.length === 0) return reciters;

  const moved = new Map<string, Reciter['rewayat']>();
  for (const merge of active) {
    const from = reciters.find(r => r.id === merge.fromId);
    const rewayat = (from?.rewayat ?? []).map(rw => ({
      ...rw,
      reciter_id: merge.toId,
    }));
    moved.set(merge.toId, [...(moved.get(merge.toId) ?? []), ...rewayat]);
  }

  const fromIds = new Set(active.map(m => m.fromId));
  return reciters
    .filter(r => !fromIds.has(r.id))
    .map(r => {
      const extra = moved.get(r.id);
      if (!extra) return r;
      const own = new Set(r.rewayat.map(rw => rw.id));
      return {
        ...r,
        rewayat: [...r.rewayat, ...extra.filter(rw => !own.has(rw.id))],
      };
    });
}

/**
 * Moves references to a merged reciter over to the reciter it was merged
 * into, anywhere inside a saved value: its id, slug and name as whole
 * strings, and ids built from it ("<id>-<surah>-<rewayat>", "<id>:<surah>")
 * as strings or object keys. Strings that only contain the id elsewhere,
 * such as download file names, are left alone so they still point at the
 * file on disk. A string list that gains a duplicate keeps one copy.
 */
export function remapMergedReciterRefs<T>(
  value: T,
  merges: readonly ReciterMerge[] = RECITER_MERGES,
): T {
  const remapString = (text: string): string => {
    for (const m of merges) {
      if (text === m.fromId) return m.toId;
      if (text === m.fromSlug) return m.toSlug;
      if (text === m.fromName) return m.toName;
      if (text.startsWith(`${m.fromId}-`) || text.startsWith(`${m.fromId}:`)) {
        return m.toId + text.slice(m.fromId.length);
      }
    }
    return text;
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return remapString(node);
    if (Array.isArray(node)) {
      const next = node.map(walk);
      const changed = next.some((item, i) => item !== node[i]);
      if (!changed) return node;
      if (next.every(item => typeof item === 'string')) {
        return [...new Set(next)];
      }
      return next;
    }
    if (node && typeof node === 'object') {
      let changed = false;
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        const nextKey = remapString(key);
        const nextChild = walk(child);
        if (nextKey !== key || nextChild !== child) changed = true;
        // A key that merges into one already present keeps the kept
        // reciter's entry.
        if (nextKey !== key && nextKey in node) continue;
        next[nextKey] = nextChild;
      }
      return changed ? next : node;
    }
    return node;
  };

  return walk(value) as T;
}

/**
 * `remapMergedReciterRefs` for a stored JSON string. Returns the same string
 * when it has nothing to move or is not JSON.
 */
export function remapMergedReciterJson(
  text: string,
  merges: readonly ReciterMerge[] = RECITER_MERGES,
): string {
  const mentions = merges.some(
    m =>
      text.includes(m.fromId) ||
      text.includes(`"${m.fromSlug}"`) ||
      text.includes(`"${m.fromName}"`),
  );
  if (!mentions) return text;
  try {
    const parsed: unknown = JSON.parse(text);
    const next = remapMergedReciterRefs(parsed, merges);
    return next === parsed ? text : JSON.stringify(next);
  } catch {
    return text;
  }
}
