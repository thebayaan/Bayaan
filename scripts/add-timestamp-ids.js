const fs = require('fs');
const path = require('path');

const RECITERS_PATH = path.join(__dirname, '..', 'data', 'reciters.json');
const MP3QURAN_READS_URL = 'https://mp3quran.net/api/v3/ayat_timing/reads';

// QDC-only manual mappings: rewayat UUID -> qdc_reciter_id
const QDC_MAPPINGS = {
  '78a256f3-b1b8-4e1f-b593-d73a6b8dc64d': 32, // Mohammed Jibreel
  'efeccedb-81c6-4ba5-b49a-f69fc723c46b': 21, // Minshawi Mujawwad
  'db736d03-e7c3-4692-ac7c-588f09ed5ad0': 20, // Mustafa Ismail
  'd375b45c-0c0f-48e1-a940-526bc1f68890': 36, // Albanna
  'ad6b3383-0004-4bba-ab91-b4f584b3be9f': 44, // Bandar Baleelah
  '243312ab-9884-4af2-a034-64774b0f2276': 49, // Maher Al Meaqli 1440
};

function normalizeUrl(url) {
  return url.replace(/\/+$/, '').toLowerCase();
}

async function main() {
  // 1. Fetch MP3Quran reads
  console.log('Fetching MP3Quran reads...');
  const response = await fetch(MP3QURAN_READS_URL, {redirect: 'follow'});
  if (!response.ok) {
    throw new Error(`Failed to fetch reads: ${response.status}`);
  }
  const reads = await response.json();
  console.log(`Fetched ${reads.length} MP3Quran reads`);

  // Build a map: normalized folder_url -> read id
  const urlToReadId = new Map();
  for (const read of reads) {
    if (read.folder_url) {
      urlToReadId.set(normalizeUrl(read.folder_url), read.id);
    }
  }

  // 2. Load reciters.json
  const reciters = JSON.parse(fs.readFileSync(RECITERS_PATH, 'utf-8'));

  let mp3quranCount = 0;
  let qdcCount = 0;

  // 3. Match MP3Quran read IDs and QDC IDs
  for (const reciter of reciters) {
    for (const rewayat of reciter.rewayat) {
      // MP3Quran matching
      if (rewayat.server) {
        const normalizedServer = normalizeUrl(rewayat.server);
        const readId = urlToReadId.get(normalizedServer);
        if (readId !== undefined) {
          rewayat.mp3quran_read_id = readId;
          mp3quranCount++;
        }
      }

      // QDC manual mapping
      if (QDC_MAPPINGS[rewayat.id] !== undefined) {
        rewayat.qdc_reciter_id = QDC_MAPPINGS[rewayat.id];
        qdcCount++;
      }
    }
  }

  // 4. Write back
  fs.writeFileSync(RECITERS_PATH, JSON.stringify(reciters, null, 2) + '\n');

  // 5. Summary
  console.log(`\nResults:`);
  console.log(`  MP3Quran read IDs matched: ${mp3quranCount}`);
  console.log(`  QDC reciter IDs set:       ${qdcCount}`);
  console.log(`\nUpdated ${RECITERS_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
