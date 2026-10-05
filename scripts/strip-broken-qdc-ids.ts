/**
 * strip-broken-qdc-ids.ts
 *
 * Sets qdc_reciter_id to null for the 5 reciters where QDC returns no timing data.
 * Idempotent -- re-running has no effect.
 *
 * Usage: npm run strip:broken-qdc -- [--dry-run]
 */

const ADMIN_URL = process.env.BAYAAN_ADMIN_URL || process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const ADMIN_TOKEN = process.env.BAYAAN_ADMIN_TOKEN;

if (!ADMIN_URL || !ADMIN_TOKEN) {
  throw new Error('Set BAYAAN_ADMIN_URL and BAYAAN_ADMIN_TOKEN.');
}

const dryRun = process.argv.includes('--dry-run');

// (rewayatId, label, qdc_id_we_are_removing)
const BROKEN: Array<{rewayatId: string; label: string; qdc: number}> = [
  {rewayatId: '78a256f3-b1b8-4e1f-b593-d73a6b8dc64d', label: 'Mohammed Jibreel', qdc: 32},
  {rewayatId: 'efeccedb-81c6-4ba5-b49a-f69fc723c46b', label: 'Minshawi Mujawwad', qdc: 21},
  {rewayatId: 'db736d03-e7c3-4692-ac7c-588f09ed5ad0', label: 'Mustafa Ismail', qdc: 20},
  {rewayatId: 'd375b45c-0c0f-48e1-a940-526bc1f68890', label: 'Albanna', qdc: 36},
  {rewayatId: '243312ab-9884-4af2-a034-64774b0f2276', label: 'Maher Mujawwad 1440', qdc: 49},
];

async function main() {
  for (const b of BROKEN) {
    const body = {qdc_reciter_id: null};
    if (dryRun) {
      console.log(`DRY ${b.label} (${b.rewayatId}): clear qdc_reciter_id=${b.qdc}`);
      continue;
    }
    const res = await fetch(`${ADMIN_URL}/admin/rewayat/${b.rewayatId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`FAIL ${b.label}: ${res.status} ${await res.text()}`);
    else console.log(`OK   ${b.label}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
