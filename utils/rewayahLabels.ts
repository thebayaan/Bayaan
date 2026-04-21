import type {RewayahId} from '@/store/mushafSettingsStore';

const SHORT_LABELS: Record<RewayahId, string> = {
  hafs: 'Hafs',
  shouba: "Shu'bah",
  bazzi: 'Al-Bazzi',
  qumbul: 'Qunbul',
  warsh: 'Warsh',
  qaloon: 'Qalun',
  doori: 'Al-Duri',
  soosi: 'Al-Susi',
};

export function getRewayahShortLabel(id: RewayahId): string {
  return SHORT_LABELS[id];
}

// Map a Supabase `rewayat.name` string (human-readable, e.g., "Hafs A'n Assem")
// to a canonical RewayahId. Lowercase+trim then match on distinguishing keyword.
// Returns null for names we don't support (e.g., Khalaf 'an Hamzah).
export function mapRewayatNameToRewayahId(
  dbName: string | null | undefined,
): RewayahId | null {
  if (!dbName) return null;
  const n = dbName.toLowerCase().trim();
  if (n.includes('hafs')) return 'hafs';
  if (n.includes('shu') || n.includes('shou')) return 'shouba';
  if (n.includes('bazz') || n.includes('bizi')) return 'bazzi';
  if (n.includes('qunb') || n.includes('qumb') || n.includes('qanb'))
    return 'qumbul';
  if (n.includes('warsh')) return 'warsh';
  if (n.includes('qalon') || n.includes('qalun') || n.includes('qaloun'))
    return 'qaloon';
  if (n.includes('dori') || n.includes('duri')) return 'doori';
  if (n.includes('susi') || n.includes('soosi') || n.includes('sosi'))
    return 'soosi';
  return null;
}
