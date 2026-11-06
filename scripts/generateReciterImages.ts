const fs = require('fs');
const path = require('path');
import {reciterImageKey} from '../utils/reciterImageKey';

const reciterImagesDir = path.join(__dirname, '..', 'assets', 'reciter-images');
const outputFile = path.join(__dirname, '..', 'utils', 'reciterImages.ts');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// The output is sorted and refuses duplicate keys, so regenerating it gives the
// same file on every machine and two images can never silently fight over one
// reciter.
function generateReciterImagesFile(): void {
  const imageMap = new Map<string, string>();
  for (const image of fs.readdirSync(reciterImagesDir) as string[]) {
    if (!SUPPORTED_EXTENSIONS.includes(path.extname(image).toLowerCase())) {
      continue;
    }
    const key = reciterImageKey(path.parse(image).name);
    const existing = imageMap.get(key);
    if (existing) {
      throw new Error(
        `${image} and ${existing} both map to "${key}"; remove one of them`,
      );
    }
    imageMap.set(key, image);
  }

  const entries = [...imageMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([key, image]) =>
        `  '${key}': require('@/assets/reciter-images/${image}'),`,
    );
  const fileContent = [
    '// Bundled asset ids (what `require` returns for an image in React Native).',
    'export const reciterImages: {[key: string]: number} = {',
    ...entries,
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(outputFile, fileContent);
  console.log(`Generated ${outputFile} (${entries.length} images)`);
}

generateReciterImagesFile();
