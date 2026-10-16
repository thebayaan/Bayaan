/**
 * Who appears in Home's reciters rail: favourites, then recently played,
 * then the default reciter, topped up with well-known reciters so the row is
 * never short. Pure, so the order is unit-tested.
 */
import type {Reciter} from '../types/reciter';
import {popularReciters} from '../services/listeningChoices';

export type HomeRecitersInput = {
  reciters: readonly Reciter[];
  favoriteIds: readonly string[];
  recentIds: readonly string[];
  defaultId: string | null;
  limit?: number;
};

export type HomeReciters = {
  title: string;
  /** True when the row comes from the user's own history or favourites. */
  personal: boolean;
  reciters: Reciter[];
};

export function pickHomeReciters({
  reciters,
  favoriteIds,
  recentIds,
  defaultId,
  limit = 12,
}: HomeRecitersInput): HomeReciters {
  const byId = new Map(reciters.map(r => [r.id, r]));
  const seen = new Set<string>();
  const out: Reciter[] = [];
  const add = (id: string | null): void => {
    if (!id || seen.has(id) || out.length >= limit) return;
    const r = byId.get(id);
    if (!r) return;
    seen.add(id);
    out.push(r);
  };
  favoriteIds.forEach(add);
  recentIds.forEach(add);
  const personal = out.length > 0;
  add(defaultId);
  // The best-known voices first (as onboarding offers them), not the
  // catalog's alphabetical order.
  popularReciters(reciters, limit).forEach(r => add(r.id));
  reciters.forEach(r => add(r.id));
  return {
    title: personal ? 'Your reciters' : 'Reciters to begin with',
    personal,
    reciters: out,
  };
}
