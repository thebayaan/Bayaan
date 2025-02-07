import {createClient} from '@supabase/supabase-js';
import fs from 'fs';
import * as dotenv from 'dotenv';
import {Rewayat} from '../data/reciterData';

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or key is missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchReciterData() {
  // Fetch reciters with their rewayat
  const {data: reciters, error: reciterError} = await supabase
    .from('reciters_new')
    .select('*')
    .order('name');

  if (reciterError) {
    console.error('Error fetching reciter data:', reciterError);
    return null;
  }

  // Fetch all rewayat
  const {data: rewayat, error: rewayatError} = await supabase
    .from('rewayat')
    .select('*')
    .order('reciter_id');

  if (rewayatError) {
    console.error('Error fetching rewayat data:', rewayatError);
    return null;
  }

  // Debug: Log the first rewayat's surah_list
  if (rewayat.length > 0) {
    console.log('First rewayat surah_list:', rewayat[0].surah_list);
    console.log('Type:', typeof rewayat[0].surah_list);
  }

  // Group rewayat by reciter_id
  const rewayatByReciter = rewayat.reduce(
    (acc, r) => {
      if (!acc[r.reciter_id]) {
        acc[r.reciter_id] = [];
      }
      acc[r.reciter_id].push({
        ...r,
        // Convert comma-separated string to array of numbers
        surah_list: r.surah_list ? r.surah_list.split(',').map(Number) : null,
      });
      return acc;
    },
    {} as Record<string, Rewayat[]>,
  );

  // Combine reciters with their rewayat
  return reciters.map(reciter => ({
    id: reciter.id,
    name: reciter.name,
    date: reciter.date,
    image_url: reciter.image_url,
    rewayat: rewayatByReciter[reciter.id] || [],
  }));
}

async function main() {
  const reciterData = await fetchReciterData();

  if (!reciterData) {
    console.error('Failed to fetch reciter data');
    return;
  }

  fs.writeFileSync('data/reciters.json', JSON.stringify(reciterData, null, 2));
  console.log('Reciter data has been written to data/reciters.json');

  // Print some stats
  console.log(`\nStats:`);
  console.log(`Total reciters: ${reciterData.length}`);
  console.log(
    `Total rewayat: ${reciterData.reduce((sum, r) => sum + r.rewayat.length, 0)}`,
  );

  // Print reciters with no rewayat
  const recitersNoRewayat = reciterData.filter(r => r.rewayat.length === 0);
  if (recitersNoRewayat.length > 0) {
    console.log('\nReciters with no rewayat:');
    recitersNoRewayat.forEach(r => console.log(`- ${r.name}`));
  }
}

main().catch(console.error);
