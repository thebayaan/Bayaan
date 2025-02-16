const {createClient} = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Define interfaces for our data structures
interface Reciter {
  id: string;
  name: string;
  date: string;
  image_url: string | null;
}

interface RewayatDB {
  id: string;
  reciter_id: string;
  name: string;
  style: string;
  server: string;
  surah_total: number;
  surah_list: string; // From database as string
  source_type: string;
  created_at: string;
}

interface RewayatTransformed extends Omit<RewayatDB, 'surah_list'> {
  surah_list: number[] | null; // Transformed to number array
}

interface ReciterWithRewayat extends Reciter {
  rewayat: RewayatTransformed[];
}

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase URL or key is missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchReciterData(): Promise<ReciterWithRewayat[] | null> {
  // Fetch reciters with their rewayat
  const {data: reciters, error: reciterError} = await supabase
    .from('reciters')
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
    (acc: Record<string, RewayatTransformed[]>, r: RewayatDB) => {
      if (!acc[r.reciter_id]) {
        acc[r.reciter_id] = [];
      }
      acc[r.reciter_id].push({
        ...r,
        surah_list: r.surah_list ? r.surah_list.split(',').map(Number) : null,
      });
      return acc;
    },
    {},
  );

  // Combine reciters with their rewayat
  const result = reciters.map(
    (reciter: Reciter): ReciterWithRewayat => ({
      id: reciter.id,
      name: reciter.name,
      date: reciter.date,
      image_url: reciter.image_url,
      rewayat: rewayatByReciter[reciter.id] || [],
    }),
  );

  // Write the result to the JSON file
  fs.writeFileSync(
    './data/reciters.json',
    JSON.stringify(result, null, 2),
    'utf8',
  );

  console.log('Successfully updated reciters.json');
  return result;
}

// Execute the function
fetchReciterData().catch(console.error);
