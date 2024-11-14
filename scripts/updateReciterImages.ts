import {createClient} from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateReciterImages() {
  const {data: reciters, error: fetchError} = await supabase
    .from('reciters')
    .select('id, name');

  if (fetchError) {
    console.error('Error fetching reciters:', fetchError);
    return;
  }

  for (const reciter of reciters) {
    const imageName = `${reciter.name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    const {
      data: {publicUrl},
      error: urlError,
    } = await supabase.storage.from('Reciter-pictures').getPublicUrl(imageName);

    if (urlError) {
      console.error(`Error getting public URL for ${reciter.name}:`, urlError);
      continue;
    }

    const {error: updateError} = await supabase
      .from('reciters')
      .update({image_url: publicUrl})
      .eq('id', reciter.id);

    if (updateError) {
      console.error(`Error updating ${reciter.name}:`, updateError);
    } else {
      console.log(`Updated ${reciter.name} with image URL: ${publicUrl}`);
    }
  }
}

updateReciterImages().catch(console.error);
