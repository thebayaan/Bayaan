/**
 * Toggle the Bayaan killswitch on Cloudflare R2.
 *
 * Usage:
 *   npx tsx scripts/toggle-killswitch.ts --disable   # Activate killswitch (use fallback)
 *   npx tsx scripts/toggle-killswitch.ts --enable    # Deactivate killswitch (use backend)
 *   npx tsx scripts/toggle-killswitch.ts --status    # Show current status
 */

import * as fs from 'fs';
import * as path from 'path';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CDN_CONFIG_URL = 'https://cdn.example.com/config/app-config.json';
const R2_BUCKET = 'bayaan-audio';
const R2_KEY = 'config/app-config.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppConfig {
  useBackendApi: boolean;
}

// ---------------------------------------------------------------------------
// Env parsing
// ---------------------------------------------------------------------------

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchCurrentConfig(): Promise<AppConfig> {
  const res = await fetch(CDN_CONFIG_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch config: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<AppConfig>;
}

function buildS3Client(env: Record<string, string>): S3Client {
  const accountId = env['R2_ACCOUNT_ID'];
  const accessKeyId = env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = env['R2_SECRET_ACCESS_KEY'];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('Missing R2 credentials in .env.r2');
    process.exit(1);
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {accessKeyId, secretAccessKey},
  });
}

async function uploadConfig(
  client: S3Client,
  config: AppConfig,
): Promise<void> {
  const body = JSON.stringify(config);
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_KEY,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=60',
    }),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = args[0];

  if (!flag || !['--enable', '--disable', '--status'].includes(flag)) {
    console.log('Usage:');
    console.log(
      '  npx tsx scripts/toggle-killswitch.ts --disable   # Use fallback data',
    );
    console.log(
      '  npx tsx scripts/toggle-killswitch.ts --enable    # Use backend API',
    );
    console.log(
      '  npx tsx scripts/toggle-killswitch.ts --status    # Check current state',
    );
    process.exit(1);
  }

  // --status: just fetch and print
  if (flag === '--status') {
    try {
      const config = await fetchCurrentConfig();
      const status = config.useBackendApi !== false ? 'ENABLED' : 'DISABLED';
      console.log(
        `Backend API is ${status} (useBackendApi: ${config.useBackendApi})`,
      );
    } catch (err) {
      console.error('Could not fetch config from CDN:', err);
      process.exit(1);
    }
    return;
  }

  const envPath = path.resolve(__dirname, '..', '.env.r2');
  const env = loadEnv(envPath);
  const client = buildS3Client(env);

  const useBackendApi = flag === '--enable';
  const config: AppConfig = {useBackendApi};

  console.log(
    `Setting useBackendApi to ${useBackendApi} (${useBackendApi ? 'backend enabled' : 'killswitch active'})...`,
  );

  await uploadConfig(client, config);

  console.log('Uploaded to R2. Verifying via CDN...');

  // Wait a moment for CDN propagation, then verify
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    const live = await fetchCurrentConfig();
    console.log(`CDN now reports: useBackendApi = ${live.useBackendApi}`);
  } catch {
    console.warn('Could not verify via CDN (may take a moment to propagate).');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
