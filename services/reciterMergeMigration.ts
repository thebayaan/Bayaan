// @ai-generated
import AsyncStorage from '@react-native-async-storage/async-storage';
import {localAggregationStore} from '@/services/analytics/LocalAggregationStore';
import {databaseService} from '@/services/database/DatabaseService';
import {uploadsDatabaseService} from '@/services/uploads/UploadsDatabaseService';
import {RECITER_MERGES, remapMergedReciterJson} from '@/utils/reciterMerges';

// Records which merges have already been applied, so the sweep runs once
// per change to RECITER_MERGES.
const APPLIED_KEY = 'bayaan_reciter_merges_applied';

// The catalog cache is folded when it loads (dataService), not rewritten.
const SKIPPED_KEYS = new Set([
  APPLIED_KEY,
  'bayaan_reciters',
  'bayaan_reciter_servers',
]);

/**
 * Moves everything saved on the device under a merged reciter's id to the
 * reciter it was merged into: every AsyncStorage value (including keys the
 * zustand stores already remap on read, so the change is saved), playlist
 * items, tagged uploads, and on-device listening time. Downloaded files keep their names; only the
 * records that point at them change.
 */
export async function applyReciterMergesToSavedData(): Promise<void> {
  const signature = RECITER_MERGES.map(m => `${m.fromId}>${m.toId}`).join(',');
  if ((await AsyncStorage.getItem(APPLIED_KEY)) === signature) return;

  const keys = (await AsyncStorage.getAllKeys()).filter(
    key => !SKIPPED_KEYS.has(key),
  );
  const entries = await AsyncStorage.multiGet(keys);
  const changed: [string, string][] = [];
  for (const [key, value] of entries) {
    if (value === null) continue;
    const next = remapMergedReciterJson(value);
    if (next !== value) changed.push([key, next]);
  }
  if (changed.length > 0) await AsyncStorage.multiSet(changed);

  await uploadsDatabaseService.initialize();
  for (const merge of RECITER_MERGES) {
    await databaseService.remapReciterId(merge.fromId, merge.toId);
    await uploadsDatabaseService.remapReciterId(merge.fromId, merge.toId);
    localAggregationStore.remapReciterId(merge.fromId, merge.toId);
  }

  await AsyncStorage.setItem(APPLIED_KEY, signature);
}
