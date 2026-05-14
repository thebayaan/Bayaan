import {analyticsService} from '@/services/analytics/AnalyticsService';
import type {EntityType, Signal, Tier} from './types';

function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

function hasNumeric(s: string): boolean {
  return /\d/.test(s);
}

export function trackSearchQuery(
  query: string,
  tabActive: EntityType | 'all',
): void {
  analyticsService.trackSearchQuery({
    query_length: query.length,
    has_arabic: hasArabic(query),
    has_numeric: hasNumeric(query),
    tab_active: tabActive,
  });
}

export function trackResultTapped(args: {
  entityType: EntityType;
  position: number;
  score: number;
  tier: Tier;
  signal: Signal | null;
  queryLength: number;
  tabActive: EntityType | 'all';
}): void {
  analyticsService.trackSearchResultTapped({
    entity_type: args.entityType,
    position: args.position,
    score: args.score,
    tier: args.tier,
    signal: args.signal,
    query_length: args.queryLength,
    tab_active: args.tabActive,
  });
}

export function trackDismissed(hadResults: boolean, queryLength: number): void {
  analyticsService.trackSearchDismissed({
    had_results: hadResults,
    query_length: queryLength,
  });
}
