#!/usr/bin/env node
/**
 * Fetch production Ibn Kathir (tafsir 169) snapshot from Quran Foundation for parity testing.
 *
 * Usage:
 *   node --experimental-strip-types scripts/parity/fetch-qf-snapshot.ts
 *
 * Or with environment sourced:
 *   set -a; . ~/.config/bayaan/qf-prod.env; set +a
 *   node --experimental-strip-types scripts/parity/fetch-qf-snapshot.ts
 *
 * Environment variables:
 *   QF_CLIENT_ID - Quran Foundation OAuth client ID
 *   QF_CLIENT_SECRET - Quran Foundation OAuth client secret
 *
 * Output:
 *   Writes snapshot to .parity/tafsir-169.json
 *   Prints only row count and byte size
 *   Exits with code 1 if credentials missing
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const clientId = process.env.QF_CLIENT_ID;
const clientSecret = process.env.QF_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  const missing: string[] = [];
  if (!clientId) missing.push('QF_CLIENT_ID');
  if (!clientSecret) missing.push('QF_CLIENT_SECRET');
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const parityDir = path.resolve(projectRoot, '.parity');
const outputFile = path.resolve(parityDir, 'tafsir-169.json');

async function getToken(): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://oauth2.quran.foundation/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=content',
  });

  if (!response.ok) {
    throw new Error(`Token request failed with status ${response.status}`);
  }

  interface TokenResponse {
    access_token: string;
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

interface Snapshot {
  records: unknown[];
}

function isSnapshot(value: unknown): value is Snapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'records' in value &&
    Array.isArray(value.records)
  );
}

async function fetchSnapshot(token: string): Promise<string> {
  const response = await fetch(
    'https://apis.quran.foundation/content/api/v4/resources/snapshots/tafsirs/169',
    {
      method: 'GET',
      headers: {
        'x-auth-token': token,
        'x-client-id': clientId ?? '',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Snapshot request failed with status ${response.status}`);
  }

  return response.text();
}

async function main(): Promise<void> {
  try {
    console.error('Fetching OAuth token...');
    const token = await getToken();

    console.error('Fetching snapshot...');
    const body = await fetchSnapshot(token);

    const parsed: unknown = JSON.parse(body);
    if (!isSnapshot(parsed)) {
      throw new Error('Snapshot response has no records array');
    }

    fs.mkdirSync(parityDir, {recursive: true});
    fs.writeFileSync(outputFile, body, 'utf-8');

    const byteSize = Buffer.byteLength(body, 'utf-8');
    console.log(
      `Snapshot: ${parsed.records.length} records, ${byteSize} bytes (${(
        byteSize /
        1024 /
        1024
      ).toFixed(2)} MB)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
