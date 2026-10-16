import type {SuperCategory} from '@/types/adhkar';

/**
 * Key for a dhikr's daily tasbeeh count (stored in dhikr_counts.dhikr_id).
 * Inside a super category with its own ordered list (morning, evening) the
 * count belongs to that list, so a dhikr in both lists keeps two counts.
 * Everywhere else (other categories, Saved, the widget) the key is the plain
 * dhikr id.
 */
export function dhikrCountKey(
  dhikrId: string,
  superCategory?: Pick<SuperCategory, 'id' | 'dhikrIds'> | null,
): string {
  if (!superCategory?.dhikrIds) return dhikrId;
  return `${superCategory.id}:${dhikrId}`;
}
