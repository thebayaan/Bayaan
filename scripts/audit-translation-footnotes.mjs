#!/usr/bin/env node
// Audits Quran.com's translation catalog and counts how many translations
// actually ship inline footnote markers (`<sup foot_note=...`).

const LIST_URL = 'https://api.quran.com/api/v4/resources/translations';
const TRANS_URL = id => `https://api.quran.com/api/v4/quran/translations/${id}`;
const CONCURRENCY = 6;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function probe(meta) {
  try {
    const body = await fetchJson(TRANS_URL(meta.id));
    const entries = body?.translations ?? [];
    let markers = 0;
    let verses = 0;
    for (const e of entries) {
      if (typeof e.text === 'string' && e.text.includes('foot_note')) {
        const n = (e.text.match(/foot_note/g) ?? []).length;
        markers += n;
        verses += 1;
      }
    }
    return {...meta, markers, verses};
  } catch (err) {
    return {...meta, error: err.message};
  }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      done++;
      if (done % 10 === 0 || done === items.length) {
        process.stdout.write(`  ${done}/${items.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({length: concurrency}, next));
  return results;
}

async function main() {
  const list = (await fetchJson(LIST_URL)).translations;
  console.log(`Probing ${list.length} translations…`);
  const rows = await runPool(
    list.map(t => ({
      id: t.id,
      name: t.name,
      language: t.language_name,
      slug: t.slug,
    })),
    probe,
    CONCURRENCY,
  );

  const withFootnotes = rows.filter(r => r.markers > 0);
  const withoutFootnotes = rows.filter(r => r.error == null && r.markers === 0);
  const failed = rows.filter(r => r.error != null);

  console.log('\n=== Summary ===');
  console.log(`Total translations: ${rows.length}`);
  console.log(`With footnotes:     ${withFootnotes.length}`);
  console.log(`Without footnotes:  ${withoutFootnotes.length}`);
  console.log(`Failed to fetch:    ${failed.length}`);

  console.log('\n=== Translations with footnotes ===');
  withFootnotes
    .sort((a, b) => b.markers - a.markers)
    .forEach(r => {
      console.log(
        `  ${String(r.id).padStart(3)}  ${r.language.padEnd(14)}  ${r.verses.toString().padStart(4)} verses / ${r.markers.toString().padStart(5)} markers  ${r.name}`,
      );
    });

  if (failed.length > 0) {
    console.log('\n=== Failures ===');
    failed.forEach(r => console.log(`  ${r.id} ${r.name}: ${r.error}`));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
