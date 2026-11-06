// Content state of the adhkar session Live Activity. Field names match
// AdhkarSessionActivityState.swift (identical copies in modules/bayaan-widgets/ios
// and targets/widgets/LiveActivity); both decode
// __fixtures__/adhkarActivity.states.json.
import {isRecord} from './guards';

export interface AdhkarSessionActivityState {
  listTitle: string; // already localized, as the lock screen title shows it
  preview: string; // first 60 characters of the clean Arabic
  position: number; // 1-based
  total: number;
  isPlaying: boolean;
}

export function isAdhkarSessionActivityState(
  value: unknown,
): value is AdhkarSessionActivityState {
  return (
    isRecord(value) &&
    typeof value.listTitle === 'string' &&
    typeof value.preview === 'string' &&
    Number.isInteger(value.position) &&
    Number.isInteger(value.total) &&
    typeof value.isPlaying === 'boolean'
  );
}
