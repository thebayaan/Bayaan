import fs from 'fs';
import path from 'path';
import appJson from '../app.json';
import {fonts} from '../theme/typography';

type FontObject = {
  fontFamily: string;
  fontDefinitions: {path: string; weight: number}[];
};

const WEIGHTS: Record<string, number> = {
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
};

function androidFonts(): FontObject[] {
  const entry = appJson.expo.plugins.find(
    plugin => Array.isArray(plugin) && plugin[0] === 'expo-font',
  );
  if (!Array.isArray(entry)) return [];
  const options = entry[1] as {android?: {fonts?: FontObject[]}};
  return options.android?.fonts ?? [];
}

describe('Android brand font registration (app.json expo-font plugin)', () => {
  it('registers every Manrope family the styles reference', () => {
    const registered = androidFonts().map(f => f.fontFamily);
    expect(registered.sort()).toEqual(Object.values(fonts).sort());
  });

  it('gives each family its own face at the weight its name says, so a bold fontWeight never falls back to Roboto', () => {
    for (const font of androidFonts()) {
      const face = font.fontFamily.replace('Manrope-', '');
      expect(font.fontDefinitions).toEqual([
        {path: `./assets/fonts/Manrope-${face}.ttf`, weight: WEIGHTS[face]},
      ]);
      const file = path.join(__dirname, '..', font.fontDefinitions[0].path);
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});
