#!/usr/bin/env node

/**
 * This script tests the rewayat name filtering logic to ensure it works correctly.
 * 
 * Run with: node scripts/test-rewayat-name-filter.js
 */

const fs = require('fs');
const path = require('path');

// Path to the reciter data file
const jsonPath = path.join(__dirname, '../data/reciters.json');

// Test the rewayat name filtering logic
function testRewayatNameFiltering() {
  console.log('Testing rewayat name filtering logic...\n');
  
  try {
    // Load the reciters data
    const reciters = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!reciters || !Array.isArray(reciters)) {
      console.error('Invalid reciters data format');
      return;
    }
    
    console.log(`Found ${reciters.length} reciters\n`);
    
    // Get all unique rewayat names
    const rewayatNames = new Set();
    reciters.forEach(reciter => {
      if (reciter.rewayat && Array.isArray(reciter.rewayat)) {
        reciter.rewayat.forEach(rewaya => {
          if (rewaya.name) {
            rewayatNames.add(rewaya.name);
          }
        });
      }
    });
    
    console.log(`Found ${rewayatNames.size} unique rewayat names\n`);
    
    // Pick a few random rewayat names to test
    const testRewayatNames = Array.from(rewayatNames).slice(0, 3);
    console.log('Testing with rewayat names:', testRewayatNames);
    
    // Test the filtering logic
    const filteredReciters = reciters.filter(reciter => 
      reciter.rewayat.some(rewaya => 
        testRewayatNames.includes(rewaya.name || '')
      )
    );
    
    console.log(`\nFiltered to ${filteredReciters.length} reciters\n`);
    
    // Print the filtered reciters and their matching rewayat
    filteredReciters.forEach(reciter => {
      const matchingRewayat = reciter.rewayat.filter(rewaya => 
        testRewayatNames.includes(rewaya.name || '')
      );
      
      console.log(`Reciter: ${reciter.name}`);
      matchingRewayat.forEach(rewaya => {
        console.log(`  - Rewayat: ${rewaya.name} (Style: ${rewaya.style})`);
      });
      console.log('');
    });
    
    console.log('Filtering test completed successfully!');
  } catch (error) {
    console.error('Error testing rewayat name filtering:', error);
  }
}

// Run the test
testRewayatNameFiltering(); 