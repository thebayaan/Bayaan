/**
 * Verifies that every audio URL in a reciter catalog JSON file:
 *   1. Resolves to HTTP 200 with Content-Type: audio/mpeg.
 *   2. (Default ON) The first ~64 bytes of the body are real MP3 magic.
 *
 * URL construction matches the runtime audio-url builder used by the player
 * (see services/audio/*): `${rewayat.server}/${paddedSurahNumber}.mp3`. The
 * server URL is a per-rewaya base path (with trailing slash) and the file
 * name is a 3-digit zero-padded surah number.
 *
 * Why this exists:
 *   HEAD-200 with Content-Type: audio/mpeg is necessary but NOT sufficient.
 *   A misconfigured upload pipeline can place M4A or WAV bytes at .mp3 keys
 *   with the right Content-Type — every HEAD request returns 200, but iOS
 *   silently rejects the file at playback time. Fetching the first 64 bytes
 *   via Range and asserting MP3 magic catches the codec mismatch class
 *   directly.
 *
 * Usage:
 *   npx tsx scripts/verify-catalog-urls.ts                               # default catalog
 *   npx tsx scripts/verify-catalog-urls.ts --catalog data/foo.json       # custom path
 *   npx tsx scripts/verify-catalog-urls.ts --fast                        # skip 1 RPS delay
 *   npx tsx scripts/verify-catalog-urls.ts --no-sniff                    # skip magic-byte check
 *
 * Rate-limit: 1 RPS by default (configurable via DELAY_MS). Most CDNs
 * tolerate higher rates, but 1 RPS is polite and predictable for catalog
 * sweeps.
 *
 * Exit code: 0 = all URLs passed. 1 = failures present. 2 = fatal error.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface Rewayat {
  id?: string;
  name: string;
  server: string;
  surah_list: (number | null)[] | null;
  surah_total?: number;
}

interface Reciter {
  id?: string;
  name: string;
  rewayat: Rewayat[];
}

type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'ogg' | 'flac' | 'unknown';

const DEFAULT_CATALOG = path.join(
  __dirname,
  '..',
  'data',
  'reciters-fallback.json',
);

function parseArgs() {
  const argv = process.argv.slice(2);
  const catalogIdx = argv.indexOf('--catalog');
  const catalogPath = catalogIdx >= 0 ? argv[catalogIdx + 1] : DEFAULT_CATALOG;
  return {
    catalogPath: path.resolve(catalogPath),
    fast: argv.includes('--fast'),
    sniff: !argv.includes('--no-sniff'),
  };
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function audioUrl(server: string, surah: number): string {
  // Tolerate servers with or without trailing slash.
  const trimmed = server.endsWith('/') ? server.slice(0, -1) : server;
  return `${trimmed}/${pad3(surah)}.mp3`;
}

function pickClient(url: string): typeof https | typeof http {
  return url.startsWith('http://') ? http : https;
}

function headRequest(
  url: string,
): Promise<{status: number; contentType: string}> {
  return new Promise((resolve, reject) => {
    const client = pickClient(url);
    const req = client.request(url, {method: 'HEAD', timeout: 10000}, res => {
      resolve({
        status: res.statusCode ?? 0,
        contentType: res.headers['content-type'] ?? '',
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

/**
 * Fetches the first 64 bytes of the URL via Range request and returns the
 * detected audio format from magic bytes. Some CDNs ignore Range and return
 * the full body; that's fine — we destroy the response once we have enough.
 *
 * Note: `http.request` does not follow 3xx redirects. A catalog URL that
 * 301/302s to the canonical asset will be reported as a failure here. That
 * is the intended behavior for a verifier — the catalog should reference
 * canonical URLs directly.
 */
function sniffFirstBytes(url: string): Promise<AudioFormat> {
  return new Promise((resolve, reject) => {
    const client = pickClient(url);
    const req = client.request(
      url,
      {
        method: 'GET',
        headers: {Range: 'bytes=0-63'},
        timeout: 10000,
      },
      res => {
        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (c: Buffer) => {
          if (received < 64) {
            chunks.push(c);
            received += c.length;
            if (received >= 64) res.destroy();
          }
        });
        // Only listen on `'close'` — fires both on natural end-of-stream and
        // on the `res.destroy()` above, so it's a strict superset of `'end'`.
        // Avoids the (harmless but unclean) double-resolve when both events
        // fire after destroy.
        res.on('close', () => resolve(detectFormat(Buffer.concat(chunks))));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function detectFormat(buf: Buffer): AudioFormat {
  if (buf.length < 4) return 'unknown';
  // ID3v2 tag → MP3
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'mp3';
  // MPEG audio frame sync: 11 set bits → 0xFF 0xEx/0xFx
  // eslint-disable-next-line no-bitwise
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  // RIFF...WAVE
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.length >= 12 &&
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45
  ) {
    return 'wav';
  }
  // ftyp box at bytes 4-7 (M4A / MP4-container audio)
  if (
    buf.length >= 8 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    return 'm4a';
  }
  // OggS
  if (
    buf[0] === 0x4f &&
    buf[1] === 0x67 &&
    buf[2] === 0x67 &&
    buf[3] === 0x53
  ) {
    return 'ogg';
  }
  // fLaC
  if (
    buf[0] === 0x66 &&
    buf[1] === 0x4c &&
    buf[2] === 0x61 &&
    buf[3] === 0x43
  ) {
    return 'flac';
  }
  return 'unknown';
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const {catalogPath, fast, sniff} = parseArgs();
  const delayMs = fast ? 0 : 1000;

  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog not found: ${catalogPath}`);
    process.exit(2);
  }

  const catalog: Reciter[] = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // Build URL list: one per (rewaya, surah) pair. Skip null surah entries
  // (api-v3 schema admits sparse lists for partial uploads).
  const checks: Array<{
    reciterName: string;
    rewayatName: string;
    surah: number;
    url: string;
  }> = [];
  for (const reciter of catalog) {
    for (const rewayat of reciter.rewayat ?? []) {
      const surahs = (rewayat.surah_list ?? []).filter(
        (n): n is number => typeof n === 'number',
      );
      for (const surah of surahs) {
        checks.push({
          reciterName: reciter.name,
          rewayatName: rewayat.name,
          surah,
          url: audioUrl(rewayat.server, surah),
        });
      }
    }
  }

  const totalUrls = checks.length;
  const totalReciters = catalog.length;
  const totalRewayat = catalog.reduce(
    (n, r) => n + (r.rewayat?.length ?? 0),
    0,
  );

  console.log(`\nBayaan catalog URL verifier`);
  console.log(`  ${catalogPath}`);
  console.log(
    `  ${totalReciters} reciters · ${totalRewayat} rewayat · ${totalUrls} audio URLs`,
  );
  console.log(
    `  Rate: ${
      delayMs === 0 ? 'no delay (--fast)' : `1 RPS (${delayMs}ms between)`
    }`,
  );
  console.log(
    `  Magic-byte sniff: ${sniff ? 'ON (default)' : 'OFF (--no-sniff)'}\n`,
  );

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < checks.length; i++) {
    const {reciterName, rewayatName, surah, url} = checks[i];
    const label = `[${i + 1}/${totalUrls}] ${reciterName} · ${rewayatName} · surah ${pad3(surah)}`;

    try {
      const {status, contentType} = await headRequest(url);
      const headOk = status === 200 && contentType.includes('audio/mpeg');
      if (!headOk) {
        failed++;
        const reason =
          status !== 200
            ? `HTTP ${status}`
            : `bad content-type: ${contentType}`;
        console.log(`  ✗ ${label} — ${reason}`);
        failures.push(`${url} → ${reason}`);
      } else if (sniff) {
        const fmt = await sniffFirstBytes(url);
        if (fmt === 'mp3') {
          passed++;
          process.stdout.write(`  ✓ ${label}\n`);
        } else {
          failed++;
          const reason = `magic-byte mismatch: declared audio/mpeg but bytes are ${fmt}`;
          console.log(`  ✗ ${label} — ${reason}`);
          failures.push(`${url} → ${reason}`);
        }
      } else {
        passed++;
        process.stdout.write(`  ✓ ${label}\n`);
      }
    } catch (e) {
      failed++;
      const reason = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ ${label} — ${reason}`);
      failures.push(`${url} → ${reason}`);
    }

    if (delayMs > 0 && i < checks.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  Passed: ${passed} / ${totalUrls}`);
  console.log(`  Failed: ${failed} / ${totalUrls}`);

  if (failed > 0) {
    console.log(`\nFailed URLs:`);
    failures.forEach(f => console.log(`  ${f}`));
    console.log(
      `\nIf the failure is "magic-byte mismatch", the catalog is serving a non-MP3`,
    );
    console.log(
      `codec at a .mp3 key. Re-encode the source bytes to real MP3 before upload.`,
    );
    console.log(
      `If "HTTP 4xx", check the catalog server URL or bucket state.\n`,
    );
    process.exit(1);
  }

  console.log(`\nAll URLs verified. ✓\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
