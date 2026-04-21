/**
 * Generate 1200x1200 OG card images for all 114 surahs and upload to R2.
 *
 * Usage:
 *   npx tsx scripts/generate-surah-og-images.ts            # generate + upload all 114
 *   npx tsx scripts/generate-surah-og-images.ts --dry-run   # generate first 3 to /tmp/ and open
 */

import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import {chromium} from 'playwright';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// ── Config ──────────────────────────────────────────────────────────────────

const SIZE = 1200;
const DRY_RUN = process.argv.includes('--dry-run');

// ── Load env ────────────────────────────────────────────────────────────────

dotenv.config({path: path.resolve(__dirname, '../.env.r2')});

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET = 'bayaan-audio';

if (
  !DRY_RUN &&
  (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
) {
  console.error('Missing R2 credentials in .env.r2');
  process.exit(1);
}

// ── R2 client ───────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Fonts (base64 for embedding in HTML) ────────────────────────────────────

const fontsDir = path.resolve(__dirname, '../assets/fonts');

function fontToBase64(filename: string): string {
  const buf = fs.readFileSync(path.join(fontsDir, filename));
  return buf.toString('base64');
}

const manropeSemiBoldB64 = fontToBase64('Manrope-SemiBold.ttf');
const manropeMediumB64 = fontToBase64('Manrope-Medium.ttf');
const surahNamesB64 = fontToBase64('surah_names.ttf');

// PUA codepoints from surahGlyphMap — maps surah ID to Unicode char
const SURAH_GLYPHS: Record<number, string> = {
  1: '\uE904',
  2: '\uE905',
  3: '\uE906',
  4: '\uE907',
  5: '\uE908',
  6: '\uE90B',
  7: '\uE90C',
  8: '\uE90D',
  9: '\uE90E',
  10: '\uE90F',
  11: '\uE910',
  12: '\uE911',
  13: '\uE912',
  14: '\uE913',
  15: '\uE914',
  16: '\uE915',
  17: '\uE916',
  18: '\uE917',
  19: '\uE918',
  20: '\uE919',
  21: '\uE91A',
  22: '\uE91B',
  23: '\uE91C',
  24: '\uE91D',
  25: '\uE91E',
  26: '\uE91F',
  27: '\uE920',
  28: '\uE921',
  29: '\uE922',
  30: '\uE923',
  31: '\uE924',
  32: '\uE925',
  33: '\uE926',
  34: '\uE92E',
  35: '\uE92F',
  36: '\uE930',
  37: '\uE931',
  38: '\uE909',
  39: '\uE90A',
  40: '\uE927',
  41: '\uE928',
  42: '\uE929',
  43: '\uE92A',
  44: '\uE92B',
  45: '\uE92C',
  46: '\uE92D',
  47: '\uE932',
  48: '\uE902',
  49: '\uE933',
  50: '\uE934',
  51: '\uE935',
  52: '\uE936',
  53: '\uE937',
  54: '\uE938',
  55: '\uE939',
  56: '\uE93A',
  57: '\uE93B',
  58: '\uE93C',
  59: '\uE900',
  60: '\uE901',
  61: '\uE941',
  62: '\uE942',
  63: '\uE943',
  64: '\uE944',
  65: '\uE945',
  66: '\uE946',
  67: '\uE947',
  68: '\uE948',
  69: '\uE949',
  70: '\uE94A',
  71: '\uE94B',
  72: '\uE94C',
  73: '\uE94D',
  74: '\uE94E',
  75: '\uE94F',
  76: '\uE950',
  77: '\uE951',
  78: '\uE952',
  79: '\uE93D',
  80: '\uE93E',
  81: '\uE93F',
  82: '\uE940',
  83: '\uE953',
  84: '\uE954',
  85: '\uE955',
  86: '\uE956',
  87: '\uE957',
  88: '\uE958',
  89: '\uE959',
  90: '\uE95A',
  91: '\uE95B',
  92: '\uE95C',
  93: '\uE95D',
  94: '\uE95E',
  95: '\uE95F',
  96: '\uE960',
  97: '\uE961',
  98: '\uE962',
  99: '\uE963',
  100: '\uE964',
  101: '\uE965',
  102: '\uE966',
  103: '\uE967',
  104: '\uE968',
  105: '\uE969',
  106: '\uE96A',
  107: '\uE96B',
  108: '\uE96C',
  109: '\uE96D',
  110: '\uE96E',
  111: '\uE96F',
  112: '\uE970',
  113: '\uE971',
  114: '\uE972',
};

// ── Surah data ──────────────────────────────────────────────────────────────

interface SurahData {
  id: number;
  name: string;
  name_arabic: string;
  revelation_place: string;
  translated_name_english: string;
  verses_count: number;
}

const surahDataPath = path.resolve(__dirname, '../data/surahData.json');
const surahs: SurahData[] = JSON.parse(fs.readFileSync(surahDataPath, 'utf-8'));

// ── Color palettes ──────────────────────────────────────────────────────────

const MESH_PALETTES = [
  ['#e879f9', '#a78bfa', '#38bdf8', '#34d399'], // purple dream
  ['#38bdf8', '#818cf8', '#5eead4', '#a78bfa'], // ocean depths
  ['#fbbf24', '#fb923c', '#f87171', '#e879f9'], // golden hour
  ['#f9a8d4', '#fb7185', '#a78bfa', '#38bdf8'], // rose garden
  ['#34d399', '#86efac', '#38bdf8', '#a78bfa'], // emerald forest
  ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#5eead4'], // twilight
];

const HERO_BG_DARK = [
  '#1a1520',
  '#1a1510',
  '#0a1a1a',
  '#1c1015',
  '#0f172a',
  '#0a1f15',
];
const HERO_BG_LIGHT = [
  '#f5f0ff',
  '#fdf8f0',
  '#f0fdfa',
  '#fff1f2',
  '#eef2ff',
  '#f0fdf4',
];
const HERO_ACCENT_DARK = [
  '#a78bfa',
  '#d4a574',
  '#5eead4',
  '#fda4af',
  '#a5b4fc',
  '#86efac',
];

// ── SVG Icons ───────────────────────────────────────────────────────────────

const STARBURST_PATH =
  'M1023 480.093H671.123L996.615 346.416L972.669 288.1L641.861 423.97L892.693 169.029L847.815 124.853L604.737 371.902L739.646 52.616L681.644 28.0892L543.008 356.172V0H479.992V351.951L346.343 26.3902L288.039 50.314L423.88 381.219L168.993 130.307L124.827 175.222L371.823 418.352L52.6049 283.414L28.0833 341.428L356.096 480.093H0V543.123H436.346L381.139 599.247L238.064 748.133L282.943 792.309L418.263 651.314L418.291 651.287L479.992 588.531V667.044V872H543.008V586.778L599.12 641.997L747.975 785.101L792.141 740.213L651.177 604.864L651.149 604.837L588.407 543.123H666.903H1023V480.093Z';

const MAKKAH_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18.75 9.50C18.76 9.46 18.75 9.41 18.75 9.35Q18.75 8.16 18.75 7.98C18.76 7.87 18.70 7.83 18.61 7.79Q18.55 7.76 18.44 7.72Q18.31 7.67 17.44 7.34Q17.06 7.22 16.44 7.00Q13.73 6.00 12.23 5.46C11.98 5.37 11.82 5.44 11.52 5.55Q10.53 5.90 7.95 6.85Q6.83 7.26 5.72 7.67C5.58 7.72 5.44 7.77 5.32 7.83Q5.24 7.87 5.24 7.98Q5.25 8.63 5.25 9.46A0.05 0.05 0.0 0 0 5.28 9.51Q6.80 10.12 8.16 10.65Q8.75 10.89 11.43 11.96C11.70 12.07 11.92 12.22 12.21 12.10Q12.39 12.03 12.55 11.97Q13.64 11.52 14.65 11.11Q16.66 10.32 18.72 9.53A0.05 0.05 0.0 0 0 18.75 9.50Z" fill="currentColor" stroke="currentColor" stroke-width="0.05"/>
  <path d="M18.74 11.52Q18.72 11.52 18.70 11.53Q18.60 11.57 18.30 11.70Q18.16 11.78 18.03 11.73C17.84 11.66 17.79 11.45 17.90 11.29C17.95 11.22 18.03 11.19 18.13 11.15Q18.25 11.11 18.74 10.89A0.04 0.04 0.0 0 0 18.77 10.85L18.77 10.24A0.01 0.01 0.0 0 0 18.75 10.23C17.47 10.78 16.19 11.28 14.87 11.82Q13.92 12.22 12.39 12.82Q12.16 12.91 12.10 12.92Q11.93 12.95 11.80 12.90Q11.64 12.85 10.94 12.57C8.40 11.54 6.98 10.97 5.26 10.24A0.01 0.01 0.0 0 0 5.25 10.25L5.25 10.85A0.06 0.06 0.0 0 0 5.28 10.90Q5.61 11.04 5.93 11.18Q6.06 11.24 6.11 11.36C6.19 11.55 6.06 11.74 5.86 11.74Q5.77 11.75 5.59 11.66Q5.36 11.55 5.27 11.51A0.01 0.01 0.0 0 0 5.25 11.52Q5.25 11.58 5.25 11.62Q5.25 14.95 5.25 16.30C5.25 16.38 5.25 16.49 5.32 16.54Q5.41 16.62 5.53 16.67Q6.90 17.33 7.95 17.86A0.01 0.01 0.0 0 0 7.96 17.85L7.96 14.66A0.03 0.03 0.0 0 1 7.99 14.63Q8.04 14.64 8.06 14.65Q8.78 14.97 9.58 15.34C9.65 15.38 9.64 15.41 9.64 15.49Q9.63 16.59 9.63 18.54A0.05 0.05 0.0 0 0 9.66 18.59Q9.81 18.65 10.01 18.74Q10.85 19.13 11.71 19.55Q11.87 19.63 12.05 19.61Q12.15 19.60 12.38 19.49Q12.69 19.34 13.46 18.98Q16.01 17.78 18.39 16.72C18.48 16.68 18.72 16.57 18.74 16.48Q18.77 16.36 18.76 16.25Q18.76 16.12 18.75 15.80Q18.75 13.71 18.77 11.53A0.01 0.01 0.0 0 0 18.74 11.52Z" fill="currentColor" stroke="currentColor" stroke-width="0.05"/>
  <path d="M6.42 8.07Q6.44 8.12 6.50 8.14Q8.27 8.78 11.73 10.08Q11.94 10.17 12.14 10.10Q12.33 10.04 13.37 9.65C13.97 9.43 14.89 9.09 15.40 8.90Q16.50 8.49 17.46 8.14Q17.51 8.12 17.75 8.08A0.05 0.05 0.0 0 0 17.74 8.01Q17.70 7.97 17.62 7.94Q16.45 7.58 15.59 7.27C14.35 6.84 13.50 6.53 12.44 6.15C12.23 6.08 12.10 6.01 11.91 6.03Q11.85 6.03 11.69 6.09Q10.95 6.36 9.67 6.82C8.74 7.16 7.57 7.59 6.53 7.94C6.49 7.96 6.39 8.00 6.42 8.07Z" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="0.05"/>
  <path d="M10.0541 13.1560A0.28 0.28 0.0 0 0 9.8987 12.8246L7.0528 11.5896A0.28 0.28 0.0 0 0 6.7214 11.7450L6.7186 11.7532A0.28 0.28 0.0 0 0 6.8740 12.0846L9.6199 13.3196A0.28 0.28 0.0 0 0 9.9513 13.1642L10.0541 13.1560Z" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="0.05"/>
  <path d="M17.3146 11.7486A0.28 0.28 0.0 0 0 16.9851 11.6013L14.0943 12.7924A0.28 0.28 0.0 0 0 13.9470 13.1219L13.9547 13.1301A0.28 0.28 0.0 0 0 14.2842 13.2774L17.1750 12.0863A0.28 0.28 0.0 0 0 17.3223 11.7568L17.3146 11.7486Z" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="0.05"/>
  <path d="M13.41 13.47C13.41 13.35 13.34 13.23 13.23 13.21Q13.09 13.18 13.00 13.22Q12.62 13.39 12.29 13.50C12.14 13.55 12.02 13.59 11.88 13.56Q11.76 13.54 11.63 13.49Q11.39 13.40 11.08 13.24Q10.99 13.20 10.91 13.19C10.61 13.17 10.49 13.59 10.75 13.74Q10.81 13.77 10.84 13.79Q11.28 13.99 11.85 14.24Q11.96 14.29 12.06 14.25Q12.67 14.01 13.22 13.77Q13.41 13.69 13.41 13.47Z" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="0.05"/>
</svg>`;

const MADINAH_SVG = `<svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M513.93 163.22Q513.88 163.18 513.83 163.14A0.28 0.08 39.1 0 0 513.63 163.05Q478.60 165.59 460.52 193.35C454.42 202.71 450.30 214.60 449.69 225.46Q447.64 261.49 477.42 281.87Q486.57 288.13 497.52 291.35A0.83 0.82 8.6 0 1 498.11 292.14Q498.02 313.38 498.14 325.63Q498.19 330.25 497.17 332.19Q491.25 343.53 481.57 353.83Q465.58 370.86 447.35 384.62C425.60 401.05 403.28 416.51 378.34 434.33C346.70 456.94 313.90 481.04 291.71 513.21Q278.73 532.03 267.76 557.30Q255.60 585.28 250.40 615.06C248.58 625.43 247.65 635.31 247.13 645.76Q246.30 662.55 247.37 683.23Q248.79 710.61 254.92 736.07A0.60 0.60 0.0 0 1 254.51 736.79C247.91 738.80 240.65 741.49 235.88 746.40Q233.21 749.14 233.23 753.48Q233.31 777.69 233.25 803.16C233.23 811.19 232.27 818.03 241.75 818.03Q393.98 818.00 780.88 818.02Q785.88 818.02 787.82 816.61Q790.55 814.64 790.56 810.24Q790.60 784.57 790.60 760.20C790.59 751.89 791.23 747.65 784.68 743.53Q777.97 739.31 769.45 736.90A0.81 0.80 15.3 0 1 768.89 735.93Q775.10 711.67 776.65 684.99Q778.02 661.37 776.71 641.27Q773.57 593.07 751.39 547.11Q744.71 533.25 738.96 523.76Q728.09 505.81 713.00 489.74C693.97 469.47 670.38 451.95 645.97 434.29Q635.10 426.43 598.86 400.65C577.11 385.19 554.73 368.40 537.42 348.35Q530.63 340.49 525.87 331.14A7.95 7.86 31.7 0 1 525.00 327.54L525.01 291.99A0.98 0.97 85.5 0 1 525.83 291.02C536.56 289.27 546.78 286.05 555.01 278.77Q566.38 268.72 571.96 254.37A0.43 0.43 0.0 0 0 571.29 253.87Q554.18 267.20 533.55 265.77C500.43 263.47 477.51 231.78 487.05 199.49C491.69 183.78 501.42 174.03 513.93 163.96A0.48 0.48 0.0 0 0 513.93 163.22Z" fill="currentColor" stroke="currentColor" stroke-width="2"/>
</svg>`;

// ── HTML builder ────────────────────────────────────────────────────────────

function buildHtml(surah: SurahData, dark: boolean): string {
  const idx = surah.id % 6;
  const palette = MESH_PALETTES[idx];
  const baseBg = dark ? HERO_BG_DARK[idx] : HERO_BG_LIGHT[idx];
  const accentColor = HERO_ACCENT_DARK[idx];
  const textColor = dark ? 'white' : '#1A1A1A';
  const mainOpacity = dark ? 0.18 : 0.22;
  const secondaryOpacity = dark ? 0.1 : 0.14;
  const subtleAlpha = dark ? '0.15' : '0.25';

  const isMakkah = surah.revelation_place === 'Makkah';
  const placeIcon = isMakkah ? MAKKAH_SVG : MADINAH_SVG;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @font-face {
    font-family: 'Manrope';
    font-weight: 600;
    src: url(data:font/truetype;base64,${manropeSemiBoldB64}) format('truetype');
  }
  @font-face {
    font-family: 'Manrope';
    font-weight: 500;
    src: url(data:font/truetype;base64,${manropeMediumB64}) format('truetype');
  }
  @font-face {
    font-family: 'SurahNames';
    font-weight: 400;
    src: url(data:font/truetype;base64,${surahNamesB64}) format('truetype');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${SIZE}px;
    height: ${SIZE}px;
    overflow: hidden;
    background: ${baseBg};
  }
  .card {
    width: ${SIZE}px;
    height: ${SIZE}px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .mesh {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 80px;
  }
  .top-row {
    position: absolute;
    top: 48px;
    left: 56px;
    right: 56px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .badge {
    font-family: 'Manrope', sans-serif;
    font-weight: 600;
    font-size: 36px;
    color: ${textColor};
    opacity: 0.8;
  }
  .place {
    display: flex;
    align-items: center;
    color: ${textColor};
    opacity: 0.8;
  }
  .place-icon {
    width: 48px;
    height: 48px;
    color: ${textColor};
  }
  .arabic-name {
    font-family: 'SurahNames', serif;
    font-size: 90px;
    color: ${textColor};
    margin-bottom: 16px;
  }
  .surah-name {
    font-family: 'Manrope', sans-serif;
    font-weight: 600;
    font-size: 72px;
    color: ${textColor};
    text-align: center;
    line-height: 1.2;
  }
  .translated {
    font-family: 'Manrope', sans-serif;
    font-weight: 500;
    font-size: 28px;
    color: ${textColor};
    opacity: 0.45;
    margin-top: 16px;
    text-align: center;
  }
  .bottom-row {
    position: absolute;
    bottom: 48px;
    left: 56px;
    right: 56px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .branding {
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0.8;
  }
  .branding-text {
    font-family: 'Manrope', sans-serif;
    font-weight: 600;
    font-size: 32px;
    color: ${textColor};
  }
  .starburst {
    width: 36px;
    height: 36px;
    color: ${textColor};
  }
</style>
</head>
<body>
<div class="card">
  <svg class="mesh" width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="0.2" cy="0.3" r="0.45">
        <stop offset="0%" stop-color="${palette[0]}" stop-opacity="${mainOpacity}"/>
        <stop offset="100%" stop-color="${palette[0]}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g2" cx="0.8" cy="0.75" r="0.4">
        <stop offset="0%" stop-color="${palette[1]}" stop-opacity="${mainOpacity}"/>
        <stop offset="100%" stop-color="${palette[1]}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g3" cx="0.6" cy="0.2" r="0.32">
        <stop offset="0%" stop-color="${palette[2]}" stop-opacity="${secondaryOpacity}"/>
        <stop offset="100%" stop-color="${palette[2]}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g4" cx="0.3" cy="0.85" r="0.28">
        <stop offset="0%" stop-color="${palette[3]}" stop-opacity="${secondaryOpacity}"/>
        <stop offset="100%" stop-color="${palette[3]}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g1)"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g2)"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g3)"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g4)"/>
  </svg>
  <div class="content">
    <div class="top-row">
      <div class="badge">${surah.id}</div>
      <div class="place">
        <span class="place-icon">${placeIcon}</span>
      </div>
    </div>
    <div class="arabic-name">&#x${(SURAH_GLYPHS[surah.id]?.codePointAt(0) ?? 0xe904).toString(16)};</div>
    <div class="surah-name">${surah.name}</div>
    <div class="translated">${surah.translated_name_english}</div>
    <div class="bottom-row">
      <div class="branding">
        <svg class="starburst" viewBox="0 0 1023 872" xmlns="http://www.w3.org/2000/svg">
          <path d="${STARBURST_PATH}" fill="currentColor"/>
        </svg>
        <span class="branding-text">Bayaan</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Upload to R2 ────────────────────────────────────────────────────────────

async function uploadToR2(key: string, data: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const toProcess = DRY_RUN ? surahs.slice(0, 3) : surahs;
  console.log(
    DRY_RUN
      ? `Dry run: generating ${toProcess.length} images to /tmp/`
      : `Generating and uploading ${toProcess.length} surah OG images...`,
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: {width: SIZE, height: SIZE},
    deviceScaleFactor: 1,
  });

  for (const surah of toProcess) {
    for (const mode of ['dark', 'light'] as const) {
      const page = await context.newPage();
      const html = buildHtml(surah, mode === 'dark');
      await page.setContent(html, {waitUntil: 'networkidle'});

      const png = await page.screenshot({
        type: 'png',
        clip: {x: 0, y: 0, width: SIZE, height: SIZE},
      });

      await page.close();

      const suffix = mode === 'light' ? '-light' : '';

      if (DRY_RUN) {
        const outPath = `/tmp/surah-og-${surah.id}${suffix}.png`;
        fs.writeFileSync(outPath, png);
        console.log(`  [${surah.id}] ${surah.name} (${mode}) -> ${outPath}`);
      } else {
        const key = `assets/og-images/surah/${surah.id}${suffix}.png`;
        await uploadToR2(key, Buffer.from(png));
        console.log(`  [${surah.id}] ${surah.name} (${mode}) -> ${key}`);
      }
    }
  }

  await browser.close();

  if (DRY_RUN) {
    console.log('\nOpening generated images...');
    const files = toProcess
      .flatMap(s => [
        `/tmp/surah-og-${s.id}.png`,
        `/tmp/surah-og-${s.id}-light.png`,
      ])
      .join(' ');
    execSync(`open ${files}`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
