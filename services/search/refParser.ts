import {SURAHS} from '@/data/surahData';
import type {NumericRef} from './types';

const PAGE_RE = /^(?:page|pg)\s+(\d{1,3})$/i;
const JUZ_RE = /^(?:juz|jz|j)\s+(\d{1,2})$/i;
const VERSE_RE = /^(\d{1,3}):(\d{1,3})$/;
const PLAIN_NUM_RE = /^(\d{1,3})$/;

function surahLabel(num: number): string {
  const s = SURAHS.find(x => x.id === num);
  return s ? `${s.translated_name_english} ${num}` : `Surah ${num}`;
}

export function parseRef(input: string): NumericRef[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];

  if (q === 'amma') return [{kind: 'juz', juz: 30, label: 'Juz 30 (Amma)'}];
  if (q === 'tabarak')
    return [{kind: 'juz', juz: 29, label: 'Juz 29 (Tabarak)'}];

  const verse = q.match(VERSE_RE);
  if (verse) {
    const s = Number(verse[1]);
    const a = Number(verse[2]);
    const surah = SURAHS.find(x => x.id === s);
    if (!surah || a < 1 || a > surah.verses_count) return [];
    return [
      {
        kind: 'verse',
        surah: s,
        ayah: a,
        label: `${surah.translated_name_english} ${s}:${a}`,
      },
    ];
  }

  const page = q.match(PAGE_RE);
  if (page) {
    const p = Number(page[1]);
    if (p < 1 || p > 604) return [];
    return [{kind: 'page', page: p, label: `Page ${p}`}];
  }

  const juz = q.match(JUZ_RE);
  if (juz) {
    const j = Number(juz[1]);
    if (j < 1 || j > 30) return [];
    return [{kind: 'juz', juz: j, label: `Juz ${j}`}];
  }

  const plain = q.match(PLAIN_NUM_RE);
  if (plain) {
    const n = Number(plain[1]);
    const out: NumericRef[] = [];
    if (n >= 1 && n <= 114)
      out.push({kind: 'surah', surah: n, label: surahLabel(n)});
    if (n >= 1 && n <= 30) out.push({kind: 'juz', juz: n, label: `Juz ${n}`});
    if (n >= 1 && n <= 604)
      out.push({kind: 'page', page: n, label: `Page ${n}`});
    return out;
  }

  return [];
}
