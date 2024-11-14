import * as fs from 'fs';
import * as path from 'path';

const reciterImagesDir = path.join(__dirname, '..', 'assets', 'reciter-images');
const outputFile = path.join(__dirname, '..', 'utils', 'reciterImages.ts');

function normalizeFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateReciterImagesFile(): void {
  const images = fs.readdirSync(reciterImagesDir);
  const imageMap: {[key: string]: string} = {};
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  images.forEach((image: string) => {
    const extension = path.extname(image).toLowerCase();
    if (supportedExtensions.includes(extension)) {
      const normalizedFileName = normalizeFileName(image);
      const normalizedName = normalizeFileName(path.parse(image).name);
      try {
        imageMap[normalizedName] =
          `require('@/assets/reciter-images/${normalizedFileName}')`;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error processing image ${image}: ${error.message}`);
        } else {
          console.error(`Unknown error processing image ${image}`);
        }
      }
    }
  });

  const fileContent = `
import { ImageSourcePropType } from 'react-native';

export const reciterImages: { [key: string]: ImageSourcePropType } = {
${Object.entries(imageMap)
  .map(([key, value]) => `  '${key}': ${value},`)
  .join('\n')}
};
`;

  fs.writeFileSync(outputFile, fileContent);
  console.log(`Generated ${outputFile}`);
}

generateReciterImagesFile();
