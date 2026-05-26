/**
 * add-new-reciters.ts
 *
 * Inserts Ahmad Talib bin Humaid and Hasan Al-Daghriri via the admin API.
 * Idempotent: skips if a reciter with the same slug already exists.
 *
 * Usage: npm run add:new-reciters -- [--dry-run]
 */

const ADMIN_URL = process.env.BAYAAN_ADMIN_URL || process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const ADMIN_TOKEN = process.env.BAYAAN_ADMIN_TOKEN;

if (!ADMIN_URL || !ADMIN_TOKEN) {
  throw new Error('Set BAYAAN_ADMIN_URL and BAYAAN_ADMIN_TOKEN.');
}

const dryRun = process.argv.includes('--dry-run');

interface NewReciter {
  slug: string;
  name: string;
  name_arabic: string;
  rewayat: Array<{
    name: string;
    style: string;
    server: string;
    source_type: string;
    surah_total: number;
    surah_list: number[];
    mp3quran_read_id: number;
  }>;
}

// IMPORTANT: `server` starts as mp3quran (so upload-missing-to-r2 fetches from
// there). After audio mirror completes in Task 16, Task 16 Step 6 PATCHes it
// to the R2 URL. `surah_list` is provisional and gets corrected in Task 16
// Step 5 from the actual mp3quran soar endpoint.
const RECITERS: NewReciter[] = [
  {
    slug: 'ahmad-talib-bin-humaid',
    name: 'Ahmad Talib bin Humaid',
    name_arabic: 'أحمد طالب بن حميد',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://server16.mp3quran.net/a_binhameed/Rewayat-Hafs-A-n-Assem',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: Array.from({length: 114}, (_, i) => i + 1),
        mp3quran_read_id: 137,
      },
    ],
  },
  {
    slug: 'hasan-aldaghriri',
    name: 'Hasan Al-Daghriri',
    name_arabic: 'حسن الدغريري',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://server16.mp3quran.net/H-Aldaghriri/Rewayat-Hafs-A-n-Assem',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: Array.from({length: 114}, (_, i) => i + 1),
        mp3quran_read_id: 10905,
      },
    ],
  },
];

async function findBySlug(slug: string): Promise<{id: string} | null> {
  const res = await fetch(`${ADMIN_URL}/admin/reciters?q=${encodeURIComponent(slug)}&limit=10`, {
    headers: {Authorization: `Bearer ${ADMIN_TOKEN}`},
  });
  if (!res.ok) throw new Error(`list reciters ${res.status}`);
  const json = (await res.json()) as {data: Array<{id: string; slug: string | null}>};
  return json.data.find(r => r.slug === slug) ?? null;
}

async function createReciter(r: NewReciter): Promise<string> {
  const res = await fetch(`${ADMIN_URL}/admin/reciters`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: r.name,
      name_arabic: r.name_arabic,
      slug: r.slug,
    }),
  });
  if (!res.ok) throw new Error(`create reciter ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {data: {id: string}};
  return json.data.id;
}

async function createRewayat(reciterId: string, rw: NewReciter['rewayat'][0]): Promise<string> {
  const res = await fetch(`${ADMIN_URL}/admin/reciters/${reciterId}/rewayat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rw),
  });
  if (!res.ok) throw new Error(`create rewayat ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {data: {id: string}};
  return json.data.id;
}

async function main(): Promise<void> {
  for (const r of RECITERS) {
    if (dryRun) {
      console.log(`DRY would create ${r.slug} with ${r.rewayat.length} rewayat`);
      continue;
    }
    const existing = await findBySlug(r.slug);
    if (existing) {
      console.log(`SKIP ${r.slug} (exists as ${existing.id})`);
      continue;
    }
    const reciterId = await createReciter(r);
    console.log(`OK reciter ${r.slug} -> ${reciterId}`);
    for (const rw of r.rewayat) {
      const rewayatId = await createRewayat(reciterId, rw);
      console.log(`OK   rewayat ${rw.name} (${rw.style}) -> ${rewayatId}  mp3quran_read=${rw.mp3quran_read_id}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
