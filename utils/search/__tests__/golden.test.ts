// @ai-generated
import {SURAHS} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';
import reciterData from '@/data/reciters-fallback.json';
import {createReciterSearch, createSurahSearch} from '../catalog';

const catalogue: Reciter[] = reciterData;
const reciters = createReciterSearch(catalogue);
const surahs = createSurahSearch(SURAHS);

const HUSSARY = '3aed26b2-eb4a-4daf-be85-34284d37bc57';
const ALAFASI = 'b3bca7d8-b004-4511-b46e-f3527f6b1f67';
const ABDULBASIT = '2821b3d7-ef99-49b2-9f45-bac57f8c3235';
const SHURAIM = '6c20bbf9-3c31-43ee-a70f-52ee3b53e098';
const MINSHAWI = 'b5acd08c-b023-4bf3-b806-f1b8c12d6d33';
const GHAMDI = '7cba5656-9d0a-4db8-b40c-878947bd5307';
const MEAQLI = '06c3f79f-02d9-42e8-9e9b-c6f355648305';
const AJMY = '0499ceb5-320e-4bf3-af9a-a5a6ea84d1e5';
const QATAMI = 'bcaade68-f0c8-4d6b-b3b6-725515bbd952';
const YASSER_DOSARI = 'c0f887a2-a6a8-4538-8244-1550dc34793d';
const RIFAI = '03c64a64-a830-47da-81c4-0000a74ae794'; // @ai
const SUDAIS = '9d6f5e54-c170-4063-8dec-3db3080a714a'; // @ai

describe('golden reciter queries (top result)', () => {
  it.each([
    ['husary', HUSSARY],
    ['hosary', HUSSARY],
    ['الحصري', HUSSARY],
    ['husary warsh', HUSSARY],
    ['mishari', ALAFASI],
    ['mishray', ALAFASI],
    ['afasy', ALAFASI],
    ['mishary alafasi', ALAFASI],
    ['العفاسي', ALAFASI],
    ['عفاسي', ALAFASI],
    ['ةهساشقغ', ALAFASI],
    ['abdul basit', ABDULBASIT],
    ['abd al basit', ABDULBASIT],
    ['abdelbaset', ABDULBASIT],
    ['عبد الباسط', ABDULBASIT],
    ['shuraym', SHURAIM],
    ['minshawy', MINSHAWI],
    ['ghamidi', GHAMDI],
    ['muaiqly', MEAQLI],
    ['ajami', AJMY],
    ['qatami', QATAMI],
    // @ai-start
    // Titles the catalogue does not carry.
    ['sheikh sudais', SUDAIS],
    ['sudais sheikh', SUDAIS],
    ['qari abdul basit', ABDULBASIT],
    ['sheikh mishary', ALAFASI],
    ['الشيخ ماهر المعيقلي', MEAQLI],
    ['القارئ ماهر المعيقلي', MEAQLI],
    ['الشيخ عبد الباسط', ABDULBASIT],
    // @ai-end
    // @ai-start
    // A sounded article glued to the name ("Arrifai").
    ['hani al rifai', RIFAI],
    ['hani rifai', RIFAI],
    ['hani ar-rifai', RIFAI],
    // @ai-end
  ])('%s', (query, id) => {
    expect(reciters.search(query)[0]?.item.id).toBe(id);
  });

  it('dossary returns Yasser Al-Dosari among the top three', () => {
    const top = reciters.search('dossary', 3).map(hit => hit.item.id);
    expect(top).toContain(YASSER_DOSARI);
  });
});

describe('golden surah queries (top result)', () => {
  it.each([
    ['al fatihah', 1],
    ['alfatiha', 1],
    ['fatiha', 1],
    ['fatihha', 1],
    ['الفاتحه', 1],
    ['الْفَاتِحَة', 1],
    ['hgthjpm', 1],
    ['the opener', 1],
    ['baqara', 2],
    ['bqara', 2],
    ['the cow', 2],
    ['ال عمران', 3],
    ['kahf', 18],
    ['taha', 20],
    ['مومنون', 23],
    ['المومنون', 23],
    ['yasin', 36],
    ['yaseen', 36],
    ['ya sin', 36],
    ['يس', 36],
    ['rahman', 55],
    ['mulk', 67],
    ['النبأ', 78],
    ['الضحي', 93],
    ['ikhlas', 112],
    // @ai-start
    // Doubled vowels typed for a single long one.
    ['noor', 24],
    ['feel', 105],
    ['toor', 52],
    ['teen', 95],
    ['room', 30],
    ['hadeed', 57],
    ['ibraheem', 14],
    // @ai-end
  ])('%s', (query, id) => {
    expect(surahs.search(query)[0]?.item.id).toBe(id);
  });
});
