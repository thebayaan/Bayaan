// @ts-nocheck
import {createClient} from '@supabase/supabase-js';
import fs from 'fs';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '../config';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or key is missing in config.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchSurahData() {
  const {data, error} = await supabase
    .from('surahs_temp')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching surah data:', error);
    return null;
  }

  return data;
}

async function main() {
  const surahData = await fetchSurahData();

  if (!surahData) {
    console.error('Failed to fetch surah data');
    return;
  }

  const formattedData = surahData.map(surah => ({
    id: surah.id,
    name: surah.name,
    revelation_place: surah.revelation_place,
    revelation_order: surah.revelation_order,
    bismillah_pre: surah.bismillah_pre,
    name_arabic: surah.name_arabic,
    verses_count: surah.verses_count,
    pages: surah.pages,
    translated_name_english: surah.translated_name_english,
  }));

  fs.writeFileSync(
    'app/data/surahData.json',
    JSON.stringify(formattedData, null, 2),
  );
  console.log('Surah data has been written to app/data/surahData.json');
}

main().catch(console.error);
