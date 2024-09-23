const fs = require('fs');
const path = require('path');

// Read the SVG file
const svgContent = fs.readFileSync(
  path.join(__dirname, '../assets/surahNameTuluth'),
  'utf8',
);

// Regular expression to match path elements
const pathRegex =
  /<path fill-rule="evenodd" clip-rule="evenodd" d="([^"]*)"[^>]*>/g;

// Object to store the paths
const surahPaths = {};

// Extract paths
let match;
let surahNumber = 1;
while ((match = pathRegex.exec(svgContent)) !== null && surahNumber <= 114) {
  surahPaths[surahNumber] = match[1];
  surahNumber++;
}

// Generate TypeScript code
const tsCode = `
export const surahPaths: { [key: number]: string } = ${JSON.stringify(surahPaths, null, 2)};
`;

// Write to file
fs.writeFileSync(path.join(__dirname, '../components/surahPaths.ts'), tsCode);

console.log('Surah paths have been generated and saved to surahPaths.ts');
console.log(
  `Number of surah paths generated: ${Object.keys(surahPaths).length}`,
);
