#!/usr/bin/env node

/**
 * This script tests the rewayat filtering logic to ensure it works correctly.
 * 
 * Run with: node scripts/test-rewayat-filter.js
 */

const fs = require('fs');
const path = require('path');

// Path to the reciter data file
const jsonPath = path.join(__dirname, '../data/reciters.json');

// Test the rewayat filtering logic
function testRewayatFiltering() {
  console.log('Testing rewayat filtering logic...\n');
  
  try {
    // Load the reciters data
    const reciters = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!reciters || !Array.isArray(reciters)) {
      console.error('Invalid reciters data format');
      return;
    }
    
    console.log(`Found ${reciters.length} reciters\n`);
    
    // Get all unique rewayat IDs
    const rewayatIds = new Set();
    reciters.forEach(reciter => {
      if (reciter.rewayat && Array.isArray(reciter.rewayat)) {
        reciter.rewayat.forEach(rewaya => {
          if (rewaya.id) {
            rewayatIds.add(rewaya.id);
          }
        });
      }
    });
    
    console.log(`Found ${rewayatIds.size} unique rewayat IDs\n`);
    
    // Pick a few random rewayat IDs to test
    const testRewayatIds = Array.from(rewayatIds).slice(0, 3);
    console.log('Testing with rewayat IDs:', testRewayatIds);
    
    // Test the filtering logic
    const filteredReciters = reciters.filter(reciter => 
      reciter.rewayat.some(rewaya => 
        testRewayatIds.includes(rewaya.id || '')
      )
    );
    
    console.log(`\nFiltered to ${filteredReciters.length} reciters\n`);
    
    // Print the filtered reciters and their matching rewayat
    filteredReciters.forEach(reciter => {
      const matchingRewayat = reciter.rewayat.filter(rewaya => 
        testRewayatIds.includes(rewaya.id || '')
      );
      
      console.log(`Reciter: ${reciter.name}`);
      matchingRewayat.forEach(rewaya => {
        console.log(`  - Rewayat: ${rewaya.name} (ID: ${rewaya.id})`);
      });
      console.log('');
    });
    
    console.log('Filtering test completed successfully!');
  } catch (error) {
    console.error('Error testing rewayat filtering:', error);
  }
}

// Run the test
testRewayatFiltering(); 