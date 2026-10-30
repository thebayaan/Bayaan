/**
 * migrate-reciter-images.ts
 *
 * Gives reciters a server photo in the current format: a 512 px and a 160 px
 * WebP plus a ThumbHash placeholder, uploaded through the backend's photo
 * upload (POST /admin/uploads/reciter-image, then /complete). Needs only the
 * admin login, no R2 keys.
 *
 * Usage:
 *   npm run photos:migrate -- --no-bundled [--dry-run]
 *   npm run photos:migrate -- --only slug-a,slug-b [--source-dir dir] [--dry-run]
 *   npm run photos:migrate -- --all [--dry-run]
 *
 * Which reciters (pick exactly one):
 *   --no-bundled     reciters the app has no bundled photo for
 *   --only <slugs>   these reciters
 *   --all            everyone
 *
 * Older app versions stop using their bundled photo as soon as a reciter has
 * image_url, and show the plain icon when offline with nothing cached. So
 * reciters that have a bundled photo are left alone unless --force is given;
 * use that only once the app version that reads `photo` is on most devices.
 *
 * Options:
 *   --source-dir <dir>  new photos named <slug>.<jpg|jpeg|png|webp>; they win
 *                       over every other source
 *   --dry-run           write the files and a contact sheet to --out, change nothing
 *   --out <dir>         where dry-run output goes (default .reciter-photos-out)
 *   --force             also do reciters with a bundled photo, and redo ones
 *                       that already have a placeholder
 *
 * Source for each reciter: --source-dir, then the current image_url (unless
 * it is already one of these uploads), then the bundled photo. Reciters that
 * already have a placeholder are skipped, so a rerun after a failure only does
 * what is left. A failed thumb PUT leaves an unreferenced full-size file in the
 * bucket; that is harmless, since a rerun uses a new key.
 *
 * Env: BAYAAN_ADMIN_URL plus BAYAAN_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD.
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import {
  makeVariants,
  THUMB_SIZE,
  type PhotoVariants,
} from './lib/photoVariants';
import {bundledImageKey, reciterImageKey} from '../utils/reciterImageKey';

const BUNDLED_DIR = path.resolve(__dirname, '..', 'assets', 'reciter-images');
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

interface Args {
  group: {only: string[]} | 'no-bundled' | 'all';
  sourceDir: string | null;
  dryRun: boolean;
  out: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const only = value('--only');
  const groups: Args['group'][] = [];
  if (only)
    groups.push({
      only: only
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    });
  if (argv.includes('--no-bundled')) groups.push('no-bundled');
  if (argv.includes('--all')) groups.push('all');
  if (groups.length !== 1)
    throw new Error(
      'Pick exactly one of --no-bundled, --only <slugs> or --all.',
    );
  return {
    group: groups[0],
    sourceDir: value('--source-dir') ?? null,
    dryRun: argv.includes('--dry-run'),
    out: value('--out') ?? '.reciter-photos-out',
    force: argv.includes('--force'),
  };
}

// ── admin API ────────────────────────────────────────────────────────────────

interface Reciter {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  photo: {
    full: string;
    thumb: string | null;
    placeholder: string | null;
  } | null;
}

interface UploadTarget {
  key: string;
  upload_url: string;
}

function adminClient(baseUrl: string, token: string) {
  async function call<T>(method: string, route: string, body?: unknown) {
    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? {'Content-Type': 'application/json'} : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
      throw new Error(`${method} ${route} ${res.status}: ${await res.text()}`);
    return (await res.json()) as {data: T; meta?: {total_pages: number}};
  }

  return {
    async listReciters(): Promise<Reciter[]> {
      const all: Reciter[] = [];
      for (let page = 1; ; page++) {
        const {data, meta} = await call<Reciter[]>(
          'GET',
          `/admin/reciters?page=${page}&limit=200`,
        );
        all.push(...data);
        if (!meta || page >= meta.total_pages) return all;
      }
    },

    async uploadPhoto(reciter: Reciter, v: PhotoVariants) {
      const {data: start} = await call<
        UploadTarget & {headers: Record<string, string>; thumb: UploadTarget}
      >('POST', '/admin/uploads/reciter-image', {reciter_id: reciter.id});
      for (const [target, body] of [
        [start, v.full],
        [start.thumb, v.thumb],
      ] as const) {
        const res = await fetch(target.upload_url, {
          method: 'PUT',
          headers: start.headers,
          body: new Uint8Array(body),
        });
        if (!res.ok) throw new Error(`PUT ${target.key} ${res.status}`);
      }
      await call('POST', '/admin/uploads/reciter-image/complete', {
        reciter_id: reciter.id,
        key: start.key,
        placeholder: v.placeholder,
      });
    },
  };
}

async function adminToken(baseUrl: string): Promise<string> {
  if (process.env.BAYAAN_ADMIN_TOKEN) return process.env.BAYAAN_ADMIN_TOKEN;
  const {ADMIN_EMAIL, ADMIN_PASSWORD} = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'Set BAYAAN_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD.',
    );
  }
  const res = await fetch(`${baseUrl}/admin/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
  });
  if (!res.ok)
    throw new Error(`admin login ${res.status}: ${await res.text()}`);
  return ((await res.json()) as {data: {token: string}}).data.token;
}

// ── sources ──────────────────────────────────────────────────────────────────

function imagesIn(
  dir: string,
  keyOf: (base: string) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    const {name, ext} = path.parse(file);
    if (IMAGE_EXTS.includes(ext.toLowerCase()))
      map.set(keyOf(name), path.join(dir, file));
  }
  return map;
}

const bundled = imagesIn(BUNDLED_DIR, reciterImageKey);

/** The bundled photo the app shows for this reciter, found the same way the app finds it. */
function bundledPhotoFor(r: Reciter): string | undefined {
  return bundled.get(bundledImageKey(r.name));
}

type Source = {kind: 'source-dir' | 'image_url' | 'bundled'; where: string};

function findSource(r: Reciter, picked: Map<string, string>): Source | null {
  const pickedFile = picked.get(r.slug);
  if (pickedFile) return {kind: 'source-dir', where: pickedFile};
  // A photo with a thumb is one of these uploads; encoding it again only loses quality
  if (r.image_url && !r.photo?.thumb)
    return {kind: 'image_url', where: r.image_url};
  const file = bundledPhotoFor(r);
  return file ? {kind: 'bundled', where: file} : null;
}

async function readSource(src: Source): Promise<Buffer> {
  if (src.kind !== 'image_url') return fs.promises.readFile(src.where);
  const res = await fetch(src.where);
  if (!res.ok) throw new Error(`GET ${src.where} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── dry-run output ───────────────────────────────────────────────────────────

async function writeContactSheet(
  out: string,
  entries: Array<{slug: string; thumb: Buffer}>,
) {
  if (entries.length === 0) return;
  const cols = 8;
  const rows = Math.ceil(entries.length / cols);
  await sharp({
    create: {
      width: cols * THUMB_SIZE,
      height: rows * THUMB_SIZE,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(
      entries.map((e, i) => ({
        input: e.thumb,
        left: (i % cols) * THUMB_SIZE,
        top: Math.floor(i / cols) * THUMB_SIZE,
      })),
    )
    .jpeg({quality: 85})
    .toFile(path.join(out, '_contact-sheet.jpg'));
  fs.writeFileSync(
    path.join(out, '_contact-sheet.txt'),
    entries.map((e, i) => `${i + 1}\t${e.slug}`).join('\n'),
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl =
    process.env.BAYAAN_ADMIN_URL ||
    process.env.BAYAAN_API_URL ||
    process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  if (!baseUrl) throw new Error('Set BAYAAN_ADMIN_URL.');
  const api = adminClient(baseUrl, await adminToken(baseUrl));
  const picked = args.sourceDir
    ? imagesIn(args.sourceDir, base => base)
    : new Map<string, string>();
  const reciters = await api.listReciters();

  let selected: Reciter[];
  if (args.group === 'all') selected = reciters;
  else if (args.group === 'no-bundled')
    selected = reciters.filter(r => !bundledPhotoFor(r));
  else {
    const wanted = new Set(args.group.only);
    selected = reciters.filter(r => wanted.has(r.slug));
    const unknown = args.group.only.filter(
      s => !selected.some(r => r.slug === s),
    );
    if (unknown.length) throw new Error(`Unknown slugs: ${unknown.join(', ')}`);
  }

  if (args.dryRun) fs.mkdirSync(args.out, {recursive: true});
  const report = {
    done: [] as string[],
    skipped: [] as string[],
    bundled: [] as string[],
    noSource: [] as string[],
    failed: [] as string[],
  };
  const sheet: Array<{slug: string; thumb: Buffer}> = [];

  for (const r of selected) {
    if (r.photo?.placeholder && !args.force) {
      report.skipped.push(r.slug);
      continue;
    }
    if (bundledPhotoFor(r) && !args.force) {
      report.bundled.push(r.slug);
      continue;
    }
    const src = findSource(r, picked);
    if (!src) {
      report.noSource.push(r.slug);
      continue;
    }
    try {
      const variants = await makeVariants(await readSource(src));
      if (args.dryRun) {
        fs.writeFileSync(path.join(args.out, `${r.slug}.webp`), variants.full);
        sheet.push({slug: r.slug, thumb: variants.thumb});
        console.log(`DRY ${r.slug} from ${src.kind}: ${src.where}`);
      } else {
        await api.uploadPhoto(r, variants);
        console.log(`OK  ${r.slug} from ${src.kind}`);
      }
      report.done.push(r.slug);
    } catch (err) {
      console.error(`ERR ${r.slug}: ${(err as Error).message}`);
      report.failed.push(r.slug);
    }
  }

  if (args.dryRun) await writeContactSheet(args.out, sheet);
  console.log(
    `\n${args.dryRun ? 'Would update' : 'Updated'} ${report.done.length}, ` +
      `already done ${report.skipped.length}, left on the bundled photo ${report.bundled.length}, ` +
      `no source ${report.noSource.length}, failed ${report.failed.length}`,
  );
  if (report.bundled.length)
    console.log(
      `Has a bundled photo (use --force): ${report.bundled.join(', ')}`,
    );
  if (report.noSource.length)
    console.log(`No photo for: ${report.noSource.join(', ')}`);
  if (report.failed.length) {
    console.log(`Failed: ${report.failed.join(', ')}`);
    process.exitCode = 1;
  }
  if (args.dryRun)
    console.log(
      `Files and _contact-sheet.jpg are in ${path.resolve(args.out)}`,
    );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
