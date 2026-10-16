/**
 * Generates the CarPlay / Android Auto icon tiles: the Collection screen's
 * category icons (Playlists, Reciters, Downloads, Uploads, Loved) on the same
 * tinted rounded square, the Random Recitation tile, plus a white playlist
 * glyph that the natives draw over a playlist's own colour at runtime.
 *
 * Usage:
 *   npx tsx scripts/generate-car-icon-tiles.ts [--sheet <dir>]
 *
 * Writes modules/bayaan-car/ios/icons/*.png (resource bundle) and
 * modules/bayaan-car/android/src/main/res/drawable-nodpi/*.png. With --sheet,
 * also writes every tile and a contact sheet to <dir>.
 *
 * The SVG paths are copied verbatim from components/Icons.tsx (PlaylistIcon,
 * ProfileIcon filled, DownloadIcon, MicrophoneIcon, HeartIcon filled). Keep
 * them in sync.
 */

import * as fs from 'fs';
import * as path from 'path';
import {chromium, Page} from 'playwright';

const SIZE = 256;
// Collection screen: 46pt tile, 12pt corner radius, 22pt glyph.
const RADIUS = Math.round((SIZE * 12) / 46);
const GLYPH = Math.round(SIZE * 0.5);
// Collection screen: Color(category.color).alpha(0.15) over the page.
const TINT_ALPHA = 0.15;
// CarPlay's list backgrounds; the tint is composited over them so the tile
// is opaque and looks the same over any cell or button platter.
const BACKDROPS = {dark: '#000000', light: '#FFFFFF'} as const;

const IOS_DIR = path.resolve(__dirname, '../modules/bayaan-car/ios/icons');
const ANDROID_DIR = path.resolve(
  __dirname,
  '../modules/bayaan-car/android/src/main/res/drawable-nodpi',
);

const PLAYLIST_PATH =
  'M9.94358 3.25H14.0564C15.8942 3.24998 17.3498 3.24997 18.489 3.40314C19.6614 3.56076 20.6104 3.89288 21.3588 4.64124C22.1071 5.38961 22.4392 6.33856 22.5969 7.51098C22.75 8.65019 22.75 10.1058 22.75 11.9436V12.0564C22.75 13.8942 22.75 15.3498 22.5969 16.489C22.4392 17.6614 22.1071 18.6104 21.3588 19.3588C20.6104 20.1071 19.6614 20.4392 18.489 20.5969C17.3498 20.75 15.8942 20.75 14.0564 20.75H9.94359C8.10583 20.75 6.65019 20.75 5.51098 20.5969C4.33856 20.4392 3.38961 20.1071 2.64124 19.3588C1.89288 18.6104 1.56076 17.6614 1.40314 16.489C1.24997 15.3498 1.24998 13.8942 1.25 12.0564V11.9436C1.24998 10.1058 1.24997 8.65019 1.40314 7.51098C1.56076 6.33856 1.89288 5.38961 2.64124 4.64124C3.38961 3.89288 4.33856 3.56076 5.51098 3.40314C6.65019 3.24997 8.10582 3.24998 9.94358 3.25ZM5.71085 4.88976C4.70476 5.02502 4.12511 5.27869 3.7019 5.7019C3.27869 6.12511 3.02502 6.70476 2.88976 7.71085C2.75159 8.73851 2.75 10.0932 2.75 12C2.75 13.9068 2.75159 15.2615 2.88976 16.2892C3.02502 17.2952 3.27869 17.8749 3.7019 18.2981C4.12511 18.7213 4.70476 18.975 5.71085 19.1102C6.73851 19.2484 8.09318 19.25 10 19.25H14C15.9068 19.25 17.2615 19.2484 18.2892 19.1102C19.2952 18.975 19.8749 18.7213 20.2981 18.2981C20.7213 17.8749 20.975 17.2952 21.1102 16.2892C21.2484 15.2615 21.25 13.9068 21.25 12C21.25 10.0932 21.2484 8.73851 21.1102 7.71085C20.975 6.70476 20.7213 6.12511 20.2981 5.7019C19.8749 5.27869 19.2952 5.02502 18.2892 4.88976C18.247 4.88409 18.2043 4.87865 18.161 4.87343L17.6614 6.2056C17.4381 6.80114 17.2492 7.30505 17.0482 7.70092C16.8345 8.12192 16.5764 8.48586 16.1804 8.7603C15.7844 9.03473 15.353 9.14857 14.8838 9.20087C14.4425 9.25004 13.9044 9.25002 13.2684 9.25H10.7316C10.0956 9.25002 9.55747 9.25004 9.11624 9.20087C8.647 9.14857 8.21562 9.03473 7.81962 8.7603C7.42361 8.48586 7.16555 8.12192 6.95182 7.70092C6.75085 7.30506 6.56191 6.80116 6.33862 6.20565L5.83904 4.87343C5.79575 4.87865 5.75302 4.88409 5.71085 4.88976ZM7.40276 4.77136L7.72893 5.64115C7.97023 6.28461 8.13066 6.70936 8.28934 7.02191C8.43949 7.31769 8.55609 7.44569 8.67401 7.52741C8.79193 7.60912 8.95272 7.67336 9.28238 7.7101C9.63075 7.74892 10.0848 7.75 10.772 7.75H13.228C13.9152 7.75 14.3692 7.74892 14.7176 7.7101C15.0473 7.67336 15.2081 7.60912 15.326 7.52741C15.4439 7.44569 15.5605 7.31769 15.7107 7.02191C15.8693 6.70936 16.0298 6.28461 16.2711 5.64115L16.5972 4.77136C15.8639 4.75045 15.0093 4.75 14 4.75H10C8.99068 4.75 8.13606 4.75045 7.40276 4.77136ZM5.25 13.75C5.25 12.0931 6.59315 10.75 8.25 10.75C8.30598 10.75 8.3616 10.7515 8.41682 10.7546C8.44413 10.7515 8.47189 10.75 8.5 10.75H16C16.0852 10.75 16.1671 10.7642 16.2434 10.7904C17.6655 11.0257 18.75 12.2612 18.75 13.75C18.75 15.2388 17.6655 16.4743 16.2434 16.7096C16.1671 16.7358 16.0852 16.75 16 16.75H8.5C8.47189 16.75 8.44413 16.7485 8.41682 16.7454C8.3616 16.7485 8.30598 16.75 8.25 16.75C6.59315 16.75 5.25 15.4069 5.25 13.75ZM10.8487 15.25H13.1513C12.8961 14.8087 12.75 14.2964 12.75 13.75C12.75 13.2036 12.8961 12.6913 13.1513 12.25H10.8487C11.1039 12.6913 11.25 13.2036 11.25 13.75C11.25 14.2964 11.1039 14.8087 10.8487 15.25ZM15.75 15.25C16.5784 15.25 17.25 14.5784 17.25 13.75C17.25 12.9216 16.5784 12.25 15.75 12.25C14.9216 12.25 14.25 12.9216 14.25 13.75C14.25 14.5784 14.9216 15.25 15.75 15.25ZM8.25 12.25C7.42157 12.25 6.75 12.9216 6.75 13.75C6.75 14.5784 7.42157 15.25 8.25 15.25C9.07843 15.25 9.75 14.5784 9.75 13.75C9.75 12.9216 9.07843 12.25 8.25 12.25Z';
const PROFILE_BODY_PATH =
  'M4 18C4 15.7908 5.79086 14 8 14H16C18.2091 14 20 15.7908 20 18V18C20 19.1045 19.1046 20 18 20H6C4.89543 20 4 19.1045 4 18V18Z';
const DOWNLOAD_PATH =
  'M8 12L12 16M12 16L16 12M12 16V8M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z';
const MICROPHONE_PATHS = [
  'M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z',
  'M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10',
  'M12 19V23M8 23H16',
];
const HEART_PATH =
  'M12 5.95q0.06 0 0.07-0.01c1.75-2.18 5.25-3.94 7.46-1.13 0.97 1.24 0.83 2.98 0.3 4.42-1.19 3.24-4.22 6.13-7.34 7.52q-0.17 0.08-0.48 0.08t-0.48-0.08c-3.12-1.38-6.15-4.28-7.34-7.52c-0.53-1.44-0.67-3.18 0.3-4.42 2.21-2.81 5.71-1.05 7.46 1.13q0.01 0.01 0.07 0.01z';
interface IconSpec {
  name: 'loved' | 'playlists' | 'downloads' | 'uploads' | 'reciters';
  color: string;
  svg: (color: string) => string;
}

function playlistSvg(color: string): string {
  return `<path fill-rule="evenodd" clip-rule="evenodd" d="${PLAYLIST_PATH}" fill="${color}"/>`;
}

const ICONS: IconSpec[] = [
  {
    name: 'playlists',
    color: '#6366F1',
    svg: playlistSvg,
  },
  {
    name: 'reciters',
    color: '#3B82F6',
    svg: color =>
      `<g fill="${color}"><path d="${PROFILE_BODY_PATH}"/><circle cx="12" cy="6.99997" r="3"/></g>`,
  },
  {
    name: 'downloads',
    color: '#10AC84',
    svg: color =>
      `<path d="${DOWNLOAD_PATH}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    name: 'uploads',
    color: '#8B5CF6',
    svg: color =>
      MICROPHONE_PATHS.map(
        d =>
          `<path d="${d}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
      ).join(''),
  },
  {
    name: 'loved',
    color: '#FF6B6B',
    svg: color => `<path d="${HEART_PATH}" fill="${color}"/>`,
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** `color` at `alpha` over an opaque `backdrop`, as an opaque hex colour. */
function composite(color: string, alpha: number, backdrop: string): string {
  const top = hexToRgb(color);
  const bottom = hexToRgb(backdrop);
  return (
    '#' +
    top
      .map((c, i) => Math.round(c * alpha + bottom[i] * (1 - alpha)))
      .map(c => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

function tileHtml(background: string | null, glyph: string): string {
  const tile = background
    ? `background:${background};border-radius:${RADIUS}px;`
    : '';
  return `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:transparent;}
#tile{width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center;${tile}}
</style></head><body><div id="tile">
<svg width="${GLYPH}" height="${GLYPH}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${glyph}</svg>
</div></body></html>`;
}

/**
 * The phone's Random Recitation card art (FWRibbonBackground in
 * components/hero/random-recitation/backgrounds.tsx): the same three ribbons,
 * gradients and page colour, cropped square and zoomed in so they read at
 * thumbnail size. Keep in sync with that component.
 */
function ribbonTileHtml(dark: boolean): string {
  const o = (darkOpacity: number, lightOpacity: number): number =>
    dark ? darkOpacity : lightOpacity;
  const stops1 = [
    ['0%', '#8b5cf6', o(0.4, 0.2)],
    ['25%', '#ec4899', o(0.35, 0.15)],
    ['50%', '#38bdf8', o(0.3, 0.15)],
    ['75%', '#34d399', o(0.35, 0.15)],
    ['100%', '#fbbf24', o(0.3, 0.15)],
  ];
  const stops2 = [
    ['0%', '#34d399', o(0.2, 0.1)],
    ['50%', '#8b5cf6', o(0.25, 0.12)],
    ['100%', '#ec4899', o(0.2, 0.1)],
  ];
  // Thumbnails are small: the crop zooms in, and the ribbons are drawn as
  // bands three times as thick with twice the opacity.
  const stop = ([offset, color, opacity]: (string | number)[]): string =>
    `<stop offset="${offset}" stop-color="${color}" stop-opacity="${Math.min(
      1,
      Number(opacity) * 2,
    )}"/>`;
  const svg = `<svg width="${SIZE}" height="${SIZE}" viewBox="45 0 80 80" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="rib1" x1="45" y1="0" x2="125" y2="0" gradientUnits="userSpaceOnUse">${stops1
    .map(stop)
    .join('')}</linearGradient>
<linearGradient id="rib2" x1="45" y1="0" x2="125" y2="0" gradientUnits="userSpaceOnUse">${stops2
    .map(stop)
    .join('')}</linearGradient>
</defs>
<path d="M0 55 Q50 20, 100 40 T200 35 T300 50 T400 30" fill="none" stroke="url(#rib1)" stroke-width="9" opacity="0.9" stroke-linecap="round"/>
<path d="M0 65 Q80 30, 150 50 T280 45 T400 60" fill="none" stroke="url(#rib2)" stroke-width="6" opacity="0.75" stroke-linecap="round"/>
<path d="M0 45 Q60 70, 120 45 T240 55 T360 40 T400 50" fill="none" stroke="url(#rib1)" stroke-width="4" opacity="0.5" stroke-linecap="round"/>
</svg>`;
  return `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:transparent;}
#tile{width:${SIZE}px;height:${SIZE}px;overflow:hidden;border-radius:${RADIUS}px;background:${
    dark ? '#111118' : '#f0eff5'
  };}
svg{display:block;}
</style></head><body><div id="tile">${svg}</div></body></html>`;
}

async function render(page: Page, html: string): Promise<Buffer> {
  await page.setContent(html);
  return page.locator('#tile').screenshot({omitBackground: true});
}

// The glyph is previewed the way the natives draw it: on a playlist colour.
const SHEET_PLAYLIST_SAMPLE = '#8B5CF6';

function sheetHtml(tiles: {file: string; png: Buffer}[]): string {
  const cell = (
    t: {file: string; png: Buffer},
    backdrop: string,
    ink: string,
  ): string =>
    `<figure style="margin:0;padding:16px;background:${backdrop};color:${ink};text-align:center;font:13px -apple-system,Helvetica,sans-serif">
<img width="128" height="128" style="${
      t.file.includes('glyph')
        ? `background:${SHEET_PLAYLIST_SAMPLE};border-radius:${RADIUS / 2}px`
        : ''
    }" src="data:image/png;base64,${t.png.toString('base64')}"/><figcaption>${
      t.file
    }</figcaption></figure>`;
  const row = (
    backdrop: string,
    ink: string,
    files: {file: string; png: Buffer}[],
  ): string =>
    `<div style="display:flex;gap:0">${files
      .map(t => cell(t, backdrop, ink))
      .join('')}</div>`;
  const dark = tiles.filter(t => !t.file.includes('_light'));
  const light = tiles.filter(
    t => t.file.includes('_light') || t.file.includes('glyph'),
  );
  return `<!doctype html><html><body style="margin:0" id="sheet">
<div id="tile" style="display:inline-block">${row(
    '#000000',
    '#FFFFFF',
    dark,
  )}${row('#FFFFFF', '#000000', light)}${row('#1C1C1E', '#FFFFFF', dark)}</div>
</body></html>`;
}

async function main(): Promise<void> {
  const sheetFlag = process.argv.indexOf('--sheet');
  const sheetDir = sheetFlag >= 0 ? process.argv[sheetFlag + 1] : undefined;
  fs.mkdirSync(IOS_DIR, {recursive: true});
  fs.mkdirSync(ANDROID_DIR, {recursive: true});
  if (sheetDir) fs.mkdirSync(sheetDir, {recursive: true});

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {width: SIZE, height: SIZE},
    deviceScaleFactor: 1,
  });
  const outputs: {file: string; png: Buffer}[] = [];
  for (const icon of ICONS) {
    for (const [variant, backdrop] of Object.entries(BACKDROPS)) {
      const background = composite(icon.color, TINT_ALPHA, backdrop);
      const suffix = variant === 'light' ? '_light' : '';
      outputs.push({
        file: `car_icon_${icon.name}${suffix}.png`,
        png: await render(page, tileHtml(background, icon.svg(icon.color))),
      });
    }
  }
  for (const [variant, dark] of [
    ['dark', true],
    ['light', false],
  ] as const) {
    outputs.push({
      file: `car_icon_random${variant === 'light' ? '_light' : ''}.png`,
      png: await render(page, ribbonTileHtml(dark)),
    });
  }
  // White glyph on transparent, sized to sit on a full tile of a playlist's colour.
  outputs.push({
    file: 'car_icon_playlist_glyph.png',
    png: await render(page, tileHtml(null, playlistSvg('#FFFFFF'))),
  });

  for (const {file, png} of outputs) {
    fs.writeFileSync(path.join(IOS_DIR, file), png);
    fs.writeFileSync(path.join(ANDROID_DIR, file), png);
    if (sheetDir) fs.writeFileSync(path.join(sheetDir, file), png);
    console.log(`wrote ${file}`);
  }

  if (sheetDir) {
    const sheet = await browser.newPage({viewport: {width: 1600, height: 900}});
    await sheet.setContent(sheetHtml(outputs));
    await sheet
      .locator('#tile')
      .screenshot({path: path.join(sheetDir, 'contact-sheet.png')});
    console.log(`wrote ${path.join(sheetDir, 'contact-sheet.png')}`);
  }
  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
