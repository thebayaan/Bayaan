const fs = require('fs');
const path = require('path');

const reciterImagesDir = path.join(__dirname, '..', 'assets', 'reciter-images');
const outputFile = path.join(__dirname, '..', 'utils', 'reciterImages.ts');

interface ImageMap {
  [key: string]: string;
}

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
  const imageMap: ImageMap = {};
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  images.forEach((image: string) => {
    const extension = path.extname(image).toLowerCase();
    if (supportedExtensions.includes(extension)) {
      const normalizedName = normalizeFileName(path.parse(image).name);
      try {
        imageMap[
          normalizedName
        ] = `require('@/assets/reciter-images/${image}')`;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`Error processing image ${image}: ${error.message}`);
        } else {
          console.error(`Error processing image ${image}: Unknown error`);
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
