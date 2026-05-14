import Fuse from 'fuse.js';
import {normalize, tokenize} from './normalize';
import type {Tier} from './types';

export interface FieldSpec<Row, K extends string = string> {
  key: K;
  weight: number;
}

export interface EntityIndexOptions<Row> {
  rows: Row[];
  idOf: (row: Row) => string;
  fields: Array<FieldSpec<Row>>;
  valueOf: (row: Row, key: string) => string | string[] | number | undefined;
  floor?: number;
}

export interface EntityHit {
  id: string;
  textualScore: number;
  tier: Tier;
  matchedField: string;
  matchedRange: [number, number] | null;
}

export interface EntityIndex {
  search(query: string): EntityHit[];
}

interface TokenIndexEntry {
  id: string;
  field: string;
  fieldWeight: number;
  originalToken: string;
  fullValue: string;
  range: [number, number];
}

const TIER_SCORE: Record<Tier, number> = {
  exact: 1.0,
  prefix: 0.85,
  whole_word: 0.7,
  fuzzy: 0.5,
};

function tierFor(query: string, token: string): Tier | null {
  if (token === query) return 'exact';
  if (token.startsWith(query)) return 'prefix';
  return null;
}

export function createEntityIndex<Row>(opts: EntityIndexOptions<Row>): EntityIndex {
  const floor = opts.floor ?? 0.2;
  const maxWeight = opts.fields.reduce((m, f) => Math.max(m, f.weight), 1);
  const tokenMap = new Map<string, TokenIndexEntry[]>();
  const docsForFuse: Array<{
    id: string;
    field: string;
    value: string;
    weight: number;
  }> = [];

  for (const row of opts.rows) {
    const id = opts.idOf(row);
    for (const spec of opts.fields) {
      const raw = opts.valueOf(row, spec.key);
      const values =
        raw == null ? [] : Array.isArray(raw) ? raw.map(String) : [String(raw)];
      for (const v of values) {
        const normFull = normalize(v);
        if (!normFull) continue;
        docsForFuse.push({
          id,
          field: spec.key,
          value: normFull,
          weight: spec.weight,
        });
        for (const tok of tokenize(v)) {
          const arr = tokenMap.get(tok) ?? [];
          const start = normFull.indexOf(tok);
          arr.push({
            id,
            field: spec.key,
            fieldWeight: spec.weight,
            originalToken: tok,
            fullValue: normFull,
            range: [Math.max(0, start), Math.max(0, start) + tok.length],
          });
          tokenMap.set(tok, arr);
        }
      }
    }
  }

  const fuse = new Fuse(docsForFuse, {
    keys: ['value'],
    includeScore: true,
    threshold: 0.4,
    distance: 200,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });

  function fieldScore(tierBase: number, fieldWeight: number): number {
    // Normalize weight so max-weight fields score at the full tier value.
    return tierBase * (fieldWeight / maxWeight);
  }

  function searchSingleToken(qTok: string): EntityHit[] {
    const perId = new Map<string, EntityHit>();

    for (const [tok, entries] of tokenMap) {
      const t = tierFor(qTok, tok);
      if (!t) continue;
      for (const e of entries) {
        const score = fieldScore(TIER_SCORE[t], e.fieldWeight);
        const cur = perId.get(e.id);
        if (!cur || score > cur.textualScore) {
          perId.set(e.id, {
            id: e.id,
            textualScore: score,
            tier: t,
            matchedField: e.field,
            matchedRange: e.range,
          });
        }
      }
    }

    if (perId.size === 0) {
      for (const [, entries] of tokenMap) {
        for (const e of entries) {
          if (e.fullValue.includes(qTok) && !e.originalToken.startsWith(qTok)) {
            const score = fieldScore(TIER_SCORE.whole_word, e.fieldWeight);
            const cur = perId.get(e.id);
            if (!cur || score > cur.textualScore) {
              perId.set(e.id, {
                id: e.id,
                textualScore: score,
                tier: 'whole_word',
                matchedField: e.field,
                matchedRange: e.range,
              });
            }
          }
        }
      }
    }

    if (perId.size === 0) {
      const fuseHits = fuse.search(qTok);
      for (const h of fuseHits) {
        const fScore = h.score ?? 0.5;
        const tierBase = TIER_SCORE.fuzzy * (1 - fScore);
        const score = fieldScore(tierBase, h.item.weight);
        const cur = perId.get(h.item.id);
        if (!cur || score > cur.textualScore) {
          perId.set(h.item.id, {
            id: h.item.id,
            textualScore: score,
            tier: 'fuzzy',
            matchedField: h.item.field,
            matchedRange: null,
          });
        }
      }
    }

    return [...perId.values()];
  }

  function search(query: string): EntityHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    if (tokens.length === 1) {
      return searchSingleToken(tokens[0]).filter(h => h.textualScore >= floor);
    }

    const perToken = tokens.map(searchSingleToken);
    const idCounts = new Map<string, EntityHit[]>();
    for (const list of perToken) {
      for (const h of list) {
        const arr = idCounts.get(h.id) ?? [];
        arr.push(h);
        idCounts.set(h.id, arr);
      }
    }

    const out: EntityHit[] = [];
    for (const [id, hits] of idCounts) {
      if (hits.length < tokens.length) continue;
      const product = hits.reduce((p, h) => p * h.textualScore, 1);
      const geo = Math.pow(product, 1 / hits.length);
      if (geo < floor) continue;
      const best = hits.reduce((a, b) =>
        a.textualScore >= b.textualScore ? a : b,
      );
      out.push({...best, id, textualScore: geo});
    }
    return out;
  }

  return {search};
}
