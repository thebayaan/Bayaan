import {createClient} from '@supabase/supabase-js';
import fs from 'fs';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '../config';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or key is missing in config.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchReciterData() {
  const {data, error} = await supabase
    .from('reciters_temp')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching reciter data:', error);
    return null;
  }

  return data;
}

async function main() {
  const reciterData = await fetchReciterData();

  if (!reciterData) {
    console.error('Failed to fetch reciter data');
    return;
  }

  const formattedData = reciterData.map(reciter => ({
    id: reciter.id,
    name: reciter.name,
    date: reciter.date,
    moshaf_name: reciter.moshaf_name,
    server: reciter.server,
    surah_total: reciter.surah_total,
    surah_list: reciter.surah_list
      ? reciter.surah_list.split(',').map(Number)
      : null,
    image_url: reciter.image_url || '',
  }));

  fs.writeFileSync(
    'data/reciters.json',
    JSON.stringify(formattedData, null, 2),
  );
  console.log('Reciter data has been written to app/data/reciters.json');
}

main().catch(console.error);
