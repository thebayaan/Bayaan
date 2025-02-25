#!/usr/bin/env node

/**
 * This script tests the teacher name extraction and filtering logic.
 *
 * Run with: node scripts/test-teacher-filter.js
 */

const fs = require('fs');
const path = require('path');

// Path to the reciter data file
const jsonPath = path.join(__dirname, '../data/reciters.json');

// Test the teacher name extraction and filtering logic
function testTeacherFiltering() {
  console.log('Testing teacher name extraction and filtering logic...\n');

  try {
    // Load the reciters data
    const reciters = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    if (!reciters || !Array.isArray(reciters)) {
      console.error('Invalid reciters data format');
      return;
    }

    console.log(`Found ${reciters.length} reciters\n`);

    // Extract teacher names from rewayat names
    const teachers = new Set();
    const teacherToRewayat = new Map();

    reciters.forEach(reciter => {
      if (reciter.rewayat && Array.isArray(reciter.rewayat)) {
        reciter.rewayat.forEach(rewaya => {
          if (rewaya.name) {
            // Extract teacher name (first part before "A'n")
            const parts = rewaya.name.split("A'n");
            if (parts.length > 1) {
              const teacherName = parts[0].trim();
              teachers.add(teacherName);

              // Map teacher to rewayat
              if (!teacherToRewayat.has(teacherName)) {
                teacherToRewayat.set(teacherName, []);
              }
              teacherToRewayat.get(teacherName).push(rewaya.name);
            }
          }
        });
      }
    });

    const teacherNames = Array.from(teachers).sort();
    console.log(`Found ${teacherNames.length} unique teacher names:\n`);
    teacherNames.forEach(teacher => {
      const rewayatCount = teacherToRewayat.get(teacher).length;
      const uniqueRewayatCount = new Set(teacherToRewayat.get(teacher)).size;
      console.log(
        `- ${teacher} (${uniqueRewayatCount} unique rewayat, ${rewayatCount} total occurrences)`,
      );
    });

    console.log('\n');

    // Test filtering by a few teachers
    const testTeachers = teacherNames.slice(0, 3);

    testTeachers.forEach(teacher => {
      console.log(`\nTesting filtering by teacher: ${teacher}`);

      // Filter reciters by teacher
      const filteredReciters = reciters.filter(reciter =>
        reciter.rewayat.some(
          rewaya => rewaya.name && rewaya.name.startsWith(teacher),
        ),
      );

      console.log(
        `Found ${filteredReciters.length} reciters with rewayat from ${teacher}`,
      );

      // Show the first 5 reciters and their matching rewayat
      console.log('\nSample reciters:');
      filteredReciters.slice(0, 5).forEach(reciter => {
        const matchingRewayat = reciter.rewayat.filter(
          rewaya => rewaya.name && rewaya.name.startsWith(teacher),
        );

        console.log(`  Reciter: ${reciter.name}`);
        matchingRewayat.forEach(rewaya => {
          console.log(`    - ${rewaya.name} (Style: ${rewaya.style})`);
        });
      });

      if (filteredReciters.length > 5) {
        console.log(`  ... and ${filteredReciters.length - 5} more`);
      }
    });

    console.log('\nTeacher filtering test completed successfully!');
  } catch (error) {
    console.error('Error testing teacher filtering:', error);
  }
}

// Run the test
testTeacherFiltering();
