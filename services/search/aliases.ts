import {normalize} from './normalize';

type AliasKey = 'surah' | 'rewayat' | 'reciter' | 'name';
type AliasId = number | string;

const RAW_SURAH_ALIASES: Record<number, string[]> = {
  1: ['fatiha', 'fateha', 'fatihah', 'الفاتحه', 'opening'],
  2: ['baqarah', 'baqara', 'البقره', 'cow'],
  18: ['kahf', 'الكهف', 'cave'],
  36: ['yasin', 'yaseen', 'يس', 'ya-sin', 'yāsīn'],
  55: ['rahman', 'rehman', 'الرحمن'],
  56: ['waqiah', 'waqia', 'الواقعه'],
  67: ['mulk', 'الملك', 'sovereignty'],
  112: ['ikhlas', 'ikhlaas', 'الاخلاص', 'sincerity'],
  113: ['falaq', 'الفلق', 'daybreak'],
  114: ['nas', 'naas', 'الناس', 'mankind'],
};

const RAW_REWAYAT_ALIASES: Record<string, string[]> = {
  'hafs-an-assem': ['hafs', 'حفص', 'asim'],
  'warsh-an-nafi': ['warsh', 'ورش', 'nafi'],
  'qaloon-an-nafi': ['qaloon', 'qalun', 'قالون'],
  'al-douri-an-abi-amro': ['douri', 'duri', 'الدوري'],
};

const RAW_NAME_ALIASES: Record<number, string[]> = {
  1: ['rahman', 'rehman', 'merciful', 'most merciful', 'الرحمن'],
  2: ['rahim', 'raheem', 'bestower of mercy', 'الرحيم'],
};

function buildIndex(
  raw: Record<string | number, string[]>,
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [id, list] of Object.entries(raw)) {
    m.set(`${id}`, list.map(normalize));
  }
  return m;
}

const SURAH = buildIndex(RAW_SURAH_ALIASES);
const REWAYAT = buildIndex(RAW_REWAYAT_ALIASES);
const NAMES = buildIndex(RAW_NAME_ALIASES);

export function aliasesFor(key: AliasKey, id: AliasId): string[] {
  switch (key) {
    case 'surah':
      return [...(SURAH.get(`${id}`) ?? [])];
    case 'rewayat':
      return [...(REWAYAT.get(`${id}`) ?? [])];
    case 'name':
      return [...(NAMES.get(`${id}`) ?? [])];
    case 'reciter':
      return [];
  }
}
