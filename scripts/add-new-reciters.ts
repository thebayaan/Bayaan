/**
 * add-new-reciters.ts
 *
 * Inserts new reciters (sourced from mp3quran) via the admin API.
 * Idempotent: skips if a reciter with the same slug already exists.
 *
 * Entries marked `existing: true` add rewayat to a reciter that is already in
 * the catalogue instead. Each rewayah is skipped if one with the same name and
 * style is already attached.
 *
 * Usage: npm run add:new-reciters -- [--dry-run]
 */

const ADMIN_URL =
  process.env.BAYAAN_ADMIN_URL || process.env.BAYAAN_API_URL || process.env.EXPO_PUBLIC_BAYAAN_API_URL;
// Either a ready-made admin token, or the same email/password login the
// other catalogue scripts use.
let ADMIN_TOKEN = process.env.BAYAAN_ADMIN_TOKEN;
const {ADMIN_EMAIL, ADMIN_PASSWORD} = process.env;

if (!ADMIN_URL || (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD))) {
  throw new Error('Set BAYAAN_ADMIN_URL plus BAYAAN_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD.');
}

async function login(): Promise<string> {
  const res = await fetch(`${ADMIN_URL}/admin/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
  });
  if (!res.ok) throw new Error(`admin login ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {data: {token: string}};
  return json.data.token;
}

const dryRun = process.argv.includes('--dry-run');

interface NewReciter {
  slug: string;
  name: string;
  name_arabic: string;
  existing?: boolean;
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
//
// Entries after Hasan Al-Daghriri were generated from the mp3quran v3 API
// (/api/v3/reciters), so their `surah_list` is already exact.
const ALL_SURAHS = Array.from({length: 114}, (_, i) => i + 1);

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
  {
    slug: 'abdulbadi-ghailan',
    name: 'Abdulbadi Ghailan',
    name_arabic: 'عبدالبديع غيلان',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/abdulbadi-ghailan/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10915,
      },
    ],
  },
  {
    slug: 'yusuf-al-aidroos',
    name: 'Yusuf Al-Aidroos',
    name_arabic: 'يوسف العيدروس',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/yousef-aidarous/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10904,
      },
    ],
  },
  {
    slug: 'muhammad-al-faqih',
    name: 'Muhammad Al-Faqih',
    name_arabic: 'محمد الفقيه',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/muhammad-faqih/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10906,
      },
    ],
  },
  {
    slug: 'junaid-adam-abdullah',
    name: 'Junaid Adam Abdullah',
    name_arabic: 'جنيد آدم عبدالله',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/junaid-abdullah/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10908,
      },
    ],
  },
  {
    slug: 'khalid-al-ziyadi',
    name: 'Khalid Al-Ziyadi',
    name_arabic: 'خالد الزيادي',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/khalid-ziyadi/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10909,
      },
    ],
  },
  {
    slug: 'abdulrahman-al-badr',
    name: 'Abdulrahman Al-Badr',
    name_arabic: 'عبدالرحمن بن عبدالرزاق البدر',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/abdulrahman-badr/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10913,
      },
    ],
  },
  {
    slug: 'alijon-qori',
    name: 'Alijon Qori',
    name_arabic: 'عليجان قوري حمدان',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/alijon-hamdan/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10917,
      },
    ],
  },
  {
    slug: 'mohammed-al-zubaidi',
    name: 'Mohammed Al-Zubaidi',
    name_arabic: 'محمد الزبيدي',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/muhammad-zubaidi/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10918,
      },
    ],
  },
  {
    slug: 'abdelmoujib-benkirane',
    name: 'Abdelmoujib Benkirane',
    name_arabic: 'عبد المجيب بنكيران',
    rewayat: [
      {
        name: "Warsh A'n Nafi'",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/abdelmoujib-benkirane/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10920,
      },
    ],
  },
  {
    slug: 'asim-al-luhaidan',
    name: 'Asim Al-Luhaidan',
    name_arabic: 'عاصم اللحیدان',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/asim-luhaidan/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10922,
      },
    ],
  },
  {
    slug: 'mahmoud-harfoush',
    name: 'Mahmoud Harfoush',
    name_arabic: 'محمود حرفوش',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/mahmoud-harfoush/r1',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10923,
      },
    ],
  },
  {
    slug: 'ayman-rushdi-swaid',
    name: 'Ayman Rushdi Swaid',
    name_arabic: 'أيمن رشدي سويد',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'molim',
        server: 'https://server15.mp3quran.net/a-rushdi/Almusshaf-Al-Mo-lim',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10925,
      },
    ],
  },
  {
    slug: 'ibrahim-al-shahri',
    name: 'Ibrahim Al-Shahri',
    name_arabic: 'إبراهيم الشهري',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/ibrahim-shahri/r1',
        source_type: 'mp3quran',
        surah_total: 113,
        surah_list: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
        mp3quran_read_id: 10911,
      },
    ],
  },
  {
    slug: 'alwaleed-al-shamsan',
    name: 'Alwaleed Al-Shamsan',
    name_arabic: 'الوليد الشمسان',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/waleed-shamsan/r1',
        source_type: 'mp3quran',
        surah_total: 71,
        surah_list: [1, 8, 17, 19, 20, 24, 25, 26, 29, 30, 31, 32, 33, 35, 36, 37, 41, 42, 43, 44, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 70, 75, 76, 81, 82, 85, 86, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
        mp3quran_read_id: 10910,
      },
    ],
  },
  {
    slug: 'mohammad-dibirov',
    name: 'Mohammad Dibirov',
    name_arabic: 'محمد ديبيروف',
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'murattal',
        server: 'https://cdn.mp3quran.net/audio/muhammad-dibirov/r1',
        source_type: 'mp3quran',
        surah_total: 24,
        surah_list: [2, 12, 13, 17, 18, 19, 20, 24, 26, 27, 31, 32, 36, 37, 41, 44, 53, 55, 56, 67, 70, 72, 76, 79],
        mp3quran_read_id: 10921,
      },
    ],
  },
  {
    slug: 'mohammad-al-tablaway',
    name: 'Mohammad Al-Tablaway',
    name_arabic: 'محمد الطبلاوي',
    existing: true,
    rewayat: [
      {
        name: "Hafs A'n Assem",
        style: 'mojawwad',
        server: 'https://cdn.mp3quran.net/audio/muhammad-tablawi/r2',
        source_type: 'mp3quran',
        surah_total: 114,
        surah_list: ALL_SURAHS,
        mp3quran_read_id: 10912,
      },
    ],
  },
];

interface ExistingReciter {
  id: string;
  slug: string | null;
  rewayat?: Array<{name: string; style: string}>;
}

// The admin list's `q` only matches names, so load every active reciter once
// and match slugs exactly.
let catalogue: Map<string, ExistingReciter> | null = null;

async function loadCatalogue(): Promise<Map<string, ExistingReciter>> {
  const bySlug = new Map<string, ExistingReciter>();
  for (let page = 1; ; page++) {
    const res = await fetch(`${ADMIN_URL}/admin/reciters?page=${page}&limit=200`, {
      headers: {Authorization: `Bearer ${ADMIN_TOKEN}`},
    });
    if (!res.ok) throw new Error(`list reciters ${res.status}`);
    const json = (await res.json()) as {data: ExistingReciter[]; meta: {total_pages: number}};
    for (const r of json.data) if (r.slug) bySlug.set(r.slug, r);
    if (page >= json.meta.total_pages) return bySlug;
  }
}

async function findBySlug(slug: string): Promise<ExistingReciter | null> {
  catalogue ??= await loadCatalogue();
  return catalogue.get(slug) ?? null;
}

async function createReciter(r: NewReciter): Promise<string | null> {
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
  // A hidden (inactive) reciter keeps its slug but isn't in the admin list.
  if (res.status === 409) return null;
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

async function addToExisting(r: NewReciter): Promise<void> {
  const existing = await findBySlug(r.slug);
  if (!existing) {
    console.error(`MISSING ${r.slug} — expected an existing reciter, skipping`);
    return;
  }
  // Without the current rewayat we can't tell what's already attached, so
  // refuse rather than risk inserting duplicates.
  if (!existing.rewayat) {
    console.error(`SKIP ${r.slug} — admin list returned no rewayat to dedupe against; add manually`);
    return;
  }
  for (const rw of r.rewayat) {
    const dup = existing.rewayat.some(e => e.name === rw.name && e.style === rw.style);
    if (dup) {
      console.log(`SKIP ${r.slug} rewayat ${rw.name} (${rw.style}) already attached`);
      continue;
    }
    const rewayatId = await createRewayat(existing.id, rw);
    console.log(`OK   ${r.slug} rewayat ${rw.name} (${rw.style}) -> ${rewayatId}  mp3quran_read=${rw.mp3quran_read_id}`);
  }
}

async function main(): Promise<void> {
  // Dry runs also log in: the catalogue lookup is read-only and makes the
  // preview show exactly what would be created or skipped.
  if (!ADMIN_TOKEN) ADMIN_TOKEN = await login();
  for (const r of RECITERS) {
    if (r.existing) {
      if (dryRun) {
        const found = await findBySlug(r.slug);
        const missing = r.rewayat.filter(
          rw => !found?.rewayat?.some(e => e.name === rw.name && e.style === rw.style),
        );
        console.log(
          found
            ? `DRY would add ${missing.length} rewayat to existing ${r.slug} (${missing.map(m => m.style).join(', ') || 'none'})`
            : `DRY MISSING ${r.slug} — expected an existing reciter`,
        );
        continue;
      }
      await addToExisting(r);
      continue;
    }
    const existing = await findBySlug(r.slug);
    if (existing) {
      console.log(`SKIP ${r.slug} (exists as ${existing.id})`);
      continue;
    }
    if (dryRun) {
      console.log(`DRY would create ${r.slug} with ${r.rewayat.length} rewayat`);
      continue;
    }
    const reciterId = await createReciter(r);
    if (!reciterId) {
      console.log(`SKIP ${r.slug} (slug already taken, likely a hidden reciter)`);
      continue;
    }
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
