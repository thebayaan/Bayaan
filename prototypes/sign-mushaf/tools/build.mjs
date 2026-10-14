// @ts-check
/**
 * Builds the self-contained page by inlining the ES modules in src/ and the
 * LPMQ illustrations (as data URIs).
 *   node prototypes/sign-mushaf/tools/build.mjs
 * Output: prototypes/sign-mushaf/index.html
 *
 * Modules are flattened into one classic script: `import` lines are removed
 * and `export` keywords stripped, so top-level names must be unique across
 * modules (the build checks for duplicates).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASSET_MAP} from '../src/asset-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string[]} files
 * @returns {string}
 */
function bundle(files) {
  /** @type {Map<string, string>} */
  const seen = new Map();
  const parts = files.map(f => {
    const src = readFileSync(join(root, 'src', f), 'utf8');
    const body = src
      .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^export\s+(?=(const|function|let|class|async))/gm, '')
      .replace(/^\/\/ @ts-check\s*$/gm, '');
    for (const m of body.matchAll(
      /^(?:const|function|let|class)\s+([A-Za-z_$][\w$]*)/gm,
    )) {
      const prev = seen.get(m[1]);
      if (prev)
        throw new Error(`Duplicate top-level name ${m[1]} in ${f} and ${prev}`);
      seen.set(m[1], f);
    }
    return `// ---- ${f} ----\n${body}`;
  });
  return parts.join('\n');
}

/**
 * Width and height of a PNG from its IHDR chunk.
 * @param {Buffer} buf
 * @returns {{w: number, h: number}}
 */
function pngSize(buf) {
  return {w: buf.readUInt32BE(16), h: buf.readUInt32BE(20)};
}

/**
 * @param {Record<string, string>} map
 * @returns {Record<string, {src: string, w: number, h: number}>}
 */
function inlineAssets(map) {
  /** @type {Record<string, {src: string, w: number, h: number}>} */
  const out = {};
  for (const [id, rel] of Object.entries(map)) {
    const buf = readFileSync(join(root, rel));
    out[id] = {
      src: `data:image/png;base64,${buf.toString('base64')}`,
      ...pngSize(buf),
    };
  }
  return out;
}

const assets = {
  letters: inlineAssets(ASSET_MAP.letters),
  marks: inlineAssets(ASSET_MAP.marks),
};
const script = [
  `const ASSET_DATA = ${JSON.stringify(assets)};`,
  bundle([
    'asset-map.mjs',
    'letters.mjs',
    'marks.mjs',
    'converter.mjs',
    'fatihah.mjs',
    'page.mjs',
  ]),
].join('\n');

const template = readFileSync(join(root, 'src', 'index.template.html'), 'utf8');
if (!template.includes('/*__BUNDLE__*/'))
  throw new Error('index.template.html has no bundle marker');
const html = template.replace('/*__BUNDLE__*/', () => script);
if (html.includes(String.fromCharCode(0x2014)))
  throw new Error('index.html contains an em dash');
writeFileSync(join(root, 'index.html'), html);
console.log(`index.html ${(html.length / 1024).toFixed(1)} KB`);
