// Plays each selected recitation in headless Chromium with the word highlight
// running off audio.currentTime, and screenshots it at set moments.
// Usage: node harness.mjs <outDir>
import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const OUT = path.resolve(process.argv[2] || 'out');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const shots = path.join(OUT, 'shots');
fs.mkdirSync(shots, {recursive: true});
const cases = JSON.parse(fs.readFileSync(path.join(OUT, 'cases.json'), 'utf8'));

const files = {
  '/fonts/UthmanicHafs1Ver18.ttf': path.join(ROOT, 'assets/fonts/UthmanicHafs1Ver18.ttf'),
  '/fonts/DigitalKhattFont.otf': path.join(ROOT, 'data/mushaf/digitalkhatt/DigitalKhattFont.otf'),
};
let current = null;
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') {
    const html = fs.readFileSync(path.join(HERE, 'harness.html'), 'utf8')
      .replace('<script>', `<script>window.__CASE=${JSON.stringify(current)};</script>\n<script>`);
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return res.end(html);
  }
  if (files[u]) { res.writeHead(200); return res.end(fs.readFileSync(files[u])); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(4719, r));

const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const [ci, c] of cases.entries()) {
  current = c;
  const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: 2});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const r = {rid: c.rid, title: c.title, subtitle: c.subtitle, why: c.why, surah: c.surah, audio_metrics: c.audio_metrics, shots: [], errors};
  try {
    await page.goto('http://localhost:4719/');
    await page.waitForFunction(() => window.__state().ready >= 3, null, {timeout: 60000});
    for (const [mi, m] of c.marks.entries()) {
      const landed = await page.evaluate(ms => window.__seek(ms), m.seek);
      await sleep(300);
      await page.evaluate(() => window.__play());
      await page.evaluate(() => window.__log());
      const wall0 = Date.now();
      const t0 = (await page.evaluate(() => window.__state())).t;
      for (const [label, wait] of [['start', 1300], ['later', 2600]]) {
        await sleep(wait);
        const st = await page.evaluate(() => window.__state());
        const file = `${String(ci).padStart(2, '0')}-${c.rid.slice(0, 8)}-a${m.ayah}-${label}.jpg`;
        await page.screenshot({path: path.join(shots, file), type: 'jpeg', quality: 82});
        r.shots.push({file, ayah: m.ayah, label, state: st, seek_asked: m.seek, seek_landed: landed});
      }
      const log = await page.evaluate(() => window.__log());
      await page.evaluate(() => window.__pause());
      // playback clock vs wall clock, and words the rAF loop never painted
      const tEnd = log.length ? log[log.length - 1][0] : t0;
      const wall = Date.now() - wall0;
      let skipped = 0;
      for (let i = 1; i < log.length; i++) if (log[i][1] - log[i - 1][1] > 1) skipped += log[i][1] - log[i - 1][1] - 1;
      const painted = new Set(log.map(x => x[1])).size;
      r.shots[r.shots.length - 1].window = {audio_ms: tEnd - t0, wall_ms: wall, frames: log.length, words_painted: painted, words_skipped: skipped};
    }
  } catch (e) {
    r.errors.push(String(e).slice(0, 300));
  }
  results.push(r);
  console.log(c.title, r.shots.length, 'shots', r.errors.length ? r.errors : '');
  await page.close();
}
fs.writeFileSync(path.join(OUT, 'harness.json'), JSON.stringify(results, null, 1));
await browser.close();
server.close();
