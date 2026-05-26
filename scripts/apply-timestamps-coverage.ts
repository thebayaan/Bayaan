/**
 * apply-timestamps-coverage.ts
 *
 * Reads scripts/.mirror-timestamps-report.json and PATCHes each rewayat
 * via the admin API to set has_timestamps=true and timestamps_surah_list
 * to the array of mirrored surah numbers.
 *
 * Usage: npm run apply:timestamps-coverage -- [--dry-run]
 *
 * Requires BAYAAN_ADMIN_URL and BAYAAN_ADMIN_TOKEN in .env (JWT for the admin user).
 */

import * as fs from 'fs';
import * as path from 'path';

const ADMIN_URL = process.env.BAYAAN_ADMIN_URL || process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const ADMIN_TOKEN = process.env.BAYAAN_ADMIN_TOKEN;

if (!ADMIN_URL || !ADMIN_TOKEN) {
  throw new Error('Set BAYAAN_ADMIN_URL and BAYAAN_ADMIN_TOKEN (admin JWT).');
}

const dryRun = process.argv.includes('--dry-run');

const reportPath = path.resolve(process.cwd(), 'scripts/.mirror-timestamps-report.json');
if (!fs.existsSync(reportPath)) {
  throw new Error(`Report file not found at ${reportPath}. Run mirror:timestamps first.`);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
  coverage: Record<string, number[]>;
};

async function patch(rewayatId: string, surahs: number[]) {
  const body = {
    has_timestamps: surahs.length > 0,
    timestamps_surah_list: surahs,
  };
  if (dryRun) {
    console.log(`DRY ${rewayatId}: ${JSON.stringify(body)}`);
    return;
  }
  const res = await fetch(`${ADMIN_URL}/admin/rewayat/${rewayatId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`FAIL ${rewayatId}: ${res.status} ${await res.text()}`);
  } else {
    console.log(`OK   ${rewayatId}: ${surahs.length} surahs`);
  }
}

async function main() {
  const ids = Object.keys(report.coverage);
  console.log(`Applying coverage for ${ids.length} rewayat (dryRun=${dryRun})`);
  for (const id of ids) {
    await patch(id, report.coverage[id]);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
