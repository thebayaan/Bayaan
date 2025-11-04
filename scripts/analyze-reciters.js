#!/usr/bin/env node

/**
 * This script analyzes the reciter data to extract all unique rewayat names and styles.
 * It helps understand the data structure for proper filtering in the app.
 * 
 * Run with: node scripts/analyze-reciters.js
 */

const fs = require('fs');
const path = require('path');

// Path to the reciter data file
const dataPath = path.join(__dirname, '../data/reciterData.ts');

// Function to extract the RECITERS array from the TypeScript file
function extractRecitersData(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // This is a simple approach - in a real scenario, you might want to use a TypeScript parser
    // Extract the content between export const RECITERS = [ and the last ];
    const match = fileContent.match(/export const RECITERS = (\[[\s\S]*?\]);/);
    
    if (!match || !match[1]) {
      console.error('Could not find RECITERS array in the file');
      return null;
    }
    
    // Evaluate the array (be careful with this approach in production)
    // For a safer approach, consider using a JSON parser if your data is in JSON format
    try {
      // Replace TypeScript-specific syntax with JavaScript equivalents
      const jsCompatibleString = match[1]
        .replace(/readonly/g, '')
        .replace(/:/g, ':')
        .replace(/as const/g, '');
      
      return eval(jsCompatibleString);
    } catch (evalError) {
      console.error('Error evaluating RECITERS array:', evalError);
      return null;
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

// Main function to analyze the data
function analyzeReciters() {
  console.log('Analyzing reciter data...\n');
  
  // Try to extract data from TypeScript file
  let reciters = extractRecitersData(dataPath);
  
  // If that fails, try to find a JSON file
  if (!reciters) {
    const jsonPath = path.join(__dirname, '../data/reciters.json');
    try {
      if (fs.existsSync(jsonPath)) {
        console.log('Using JSON data file instead...');
        reciters = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } else {
        console.error('Could not find reciter data in either TS or JSON format');
        return;
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
      return;
    }
  }
  
  if (!reciters || !Array.isArray(reciters)) {
    console.error('Invalid reciters data format');
    return;
  }
  
  console.log(`Found ${reciters.length} reciters\n`);
  
  // Extract unique rewayat names and styles
  const rewayatNames = new Set();
  const styles = new Set();
  const rewayatMap = new Map(); // Map style to rewayat names
  
  reciters.forEach(reciter => {
    if (reciter.rewayat && Array.isArray(reciter.rewayat)) {
      reciter.rewayat.forEach(rewaya => {
        if (rewaya.name) {
          rewayatNames.add(rewaya.name);
        }
        
        if (rewaya.style) {
          // Normalize style names
          let normalizedStyle = rewaya.style.toLowerCase();
          if (normalizedStyle.startsWith('murattal')) {
            normalizedStyle = 'murattal';
          }
          styles.add(normalizedStyle);
          
          // Group rewayat names by style
          if (!rewayatMap.has(normalizedStyle)) {
            rewayatMap.set(normalizedStyle, new Set());
          }
          if (rewaya.name) {
            rewayatMap.get(normalizedStyle).add(rewaya.name);
          }
        }
      });
    }
  });
  
  // Print results
  console.log('=== UNIQUE STYLES ===');
  const sortedStyles = Array.from(styles).sort();
  sortedStyles.forEach(style => {
    console.log(`- ${style}`);
  });
  console.log(`\nTotal unique styles: ${styles.size}\n`);
  
  console.log('=== UNIQUE REWAYAT NAMES ===');
  const sortedRewayatNames = Array.from(rewayatNames).sort();
  sortedRewayatNames.forEach(name => {
    console.log(`- ${name}`);
  });
  console.log(`\nTotal unique rewayat names: ${rewayatNames.size}\n`);
  
  console.log('=== REWAYAT NAMES BY STYLE ===');
  sortedStyles.forEach(style => {
    console.log(`\n${style.toUpperCase()}:`);
    const namesForStyle = Array.from(rewayatMap.get(style) || []).sort();
    namesForStyle.forEach(name => {
      console.log(`  - ${name}`);
    });
    console.log(`  Total: ${namesForStyle.length}`);
  });
  
  // Generate code for the filter modal
  console.log('\n=== SUGGESTED FILTER MODAL CODE ===');
  console.log(`
// Style options for filter
export const STYLE_OPTIONS = [
  { label: 'All', value: 'all' },
  ${sortedStyles.map(style => `{ label: '${style.charAt(0).toUpperCase() + style.slice(1)}', value: '${style}' }`).join(',\n  ')}
];

// Rewayat options for filter
export const REWAYAT_OPTIONS = [
  { label: 'All', value: 'all' },
  ${sortedRewayatNames.map(name => `{ label: '${name}', value: '${name}' }`).join(',\n  ')}
];
  `);
}

// Run the analysis
analyzeReciters(); 