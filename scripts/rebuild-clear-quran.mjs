#!/usr/bin/env node
// Rebuilds data/clear-quran-translation.json to mirror Saheeh's per-verse {t, f} shape
// by fetching footnote bodies from Quran.com's public API.
//
// Input:  data/clear-quran-translation.json (current: {translations: [{resource_id, text}]})
// Output: data/clear-quran-translation.json (new: {"1:1": {t, f?}, ...})

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLEAR_PATH = path.join(ROOT, 'data', 'clear-quran-translation.json');
const QURAN_PATH = path.join(ROOT, 'data', 'quran.json');
const BACKUP_PATH = path.join(
  ROOT,
  'data',
  'clear-quran-translation.backup.json',
);

const FOOTNOTE_API = id => `https://api.quran.com/api/v4/foot_notes/${id}`;
const CONCURRENCY = 16;
const MAX_RETRIES = 3;

/** @param {string} html */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize `foot_note=76373` → `foot_note="76373"` so FormattedText renderer picks it up. */
function normalizeFootnoteMarkers(text) {
  return text.replace(/foot_note=([0-9]+)/g, 'foot_note="$1"');
}

/** Extract all foot_note IDs appearing anywhere in the translation corpus. */
function collectFootnoteIds(entries) {
  const ids = new Set();
  const re = /foot_note="?(\d+)"?/g;
  for (const entry of entries) {
    let m;
    while ((m = re.exec(entry.text)) !== null) ids.add(m[1]);
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

async function fetchFootnote(id) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(FOOTNOTE_API(id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = json?.foot_note?.text;
      if (typeof raw !== 'string') throw new Error('no text field');
      return stripHtml(raw);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
  throw new Error('unreachable');
}

async function fetchAll(ids) {
  const result = Object.create(null);
  let inFlight = 0;
  let cursor = 0;
  let done = 0;
  const total = ids.length;

  return new Promise((resolve, reject) => {
    let rejected = false;
    const startNext = () => {
      if (rejected) return;
      while (inFlight < CONCURRENCY && cursor < total) {
        const id = ids[cursor++];
        inFlight++;
        fetchFootnote(id)
          .then(text => {
            result[id] = text;
            done++;
            if (done % 50 === 0 || done === total) {
              process.stdout.write(`  fetched ${done}/${total}\n`);
            }
          })
          .catch(err => {
            rejected = true;
            reject(new Error(`footnote ${id}: ${err.message}`));
          })
          .finally(() => {
            inFlight--;
            if (done === total) resolve(result);
            else startNext();
          });
      }
    };
    startNext();
  });
}

async function main() {
  console.log('Reading existing files…');
  const clearRaw = JSON.parse(await fs.readFile(CLEAR_PATH, 'utf8'));
  const quran = JSON.parse(await fs.readFile(QURAN_PATH, 'utf8'));

  if (!Array.isArray(clearRaw?.translations)) {
    throw new Error(
      'Unexpected clear-quran-translation.json shape — aborting.',
    );
  }

  const entries = clearRaw.translations;
  console.log(`Loaded ${entries.length} Clear Quran verses.`);

  const ids = collectFootnoteIds(entries);
  console.log(`Found ${ids.length} unique footnote IDs.`);

  console.log('Backing up current file…');
  await fs.copyFile(CLEAR_PATH, BACKUP_PATH);

  console.log('Fetching footnote bodies from quran.com…');
  const footnoteMap = await fetchAll(ids);

  console.log('Building verse-keyed output…');
  // Map global 1-based ID → verse_key via quran.json
  const idToKey = new Map();
  for (const verse of Object.values(quran)) {
    idToKey.set(verse.id, verse.verse_key);
  }

  const out = Object.create(null);
  entries.forEach((entry, idx) => {
    const globalId = idx + 1;
    const verseKey = idToKey.get(globalId);
    if (!verseKey) throw new Error(`no verse_key for global id ${globalId}`);

    const normalized = normalizeFootnoteMarkers(entry.text);
    const perVerseIds = new Set();
    const re = /foot_note="(\d+)"/g;
    let m;
    while ((m = re.exec(normalized)) !== null) perVerseIds.add(m[1]);

    const verseObj = {t: normalized};
    if (perVerseIds.size > 0) {
      verseObj.f = {};
      for (const id of perVerseIds) {
        verseObj.f[id] = footnoteMap[id];
      }
    }
    out[verseKey] = verseObj;
  });

  await fs.writeFile(CLEAR_PATH, JSON.stringify(out));
  const {size} = await fs.stat(CLEAR_PATH);
  console.log(`Wrote ${CLEAR_PATH} (${(size / 1024).toFixed(1)} KB).`);
  console.log(`Backup: ${BACKUP_PATH}`);
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
