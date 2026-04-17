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
