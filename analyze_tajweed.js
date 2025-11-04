const fs = require('fs');

try {
  // Read the file
  const data = fs.readFileSync('data/QPC Hafs Tajweed 2.json', 'utf8');
  const jsonData = JSON.parse(data);

  console.log('File loaded successfully');

  // Check for structure
  if (!jsonData.surahs) {
    console.log('Unexpected file structure: no surahs property');
    process.exit(1);
  }

  let totalWords = 0;
  let wordsWithRules = 0;
  let multipleRuleWords = 0;
  let ruleStarts = 0;
  let ruleEnds = 0;
  let overlappingExamples = [];

  // Process each surah
  jsonData.surahs.forEach(surah => {
    // Process each ayah
    surah.ayahs.forEach(ayah => {
      if (ayah.text) {
        const words = ayah.text.split(' ');
        totalWords += words.length;

        // Check each word for rules
        words.forEach(word => {
          const startTags = (word.match(/<rule class=/g) || []).length;
          const endTags = (word.match(/<\/rule>/g) || []).length;

          ruleStarts += startTags;
          ruleEnds += endTags;

          if (startTags > 0) {
            wordsWithRules++;
          }

          if (startTags > 1) {
            multipleRuleWords++;

            // Check for potential overlapping rules (mismatched tags)
            if (startTags !== endTags) {
              overlappingExamples.push({
                surah: surah.number,
                ayah: ayah.numberInSurah,
                word,
                startTags,
                endTags,
              });
            }

            // Or check for nested rules
            if (word.match(/<rule class=[^>]+><rule class=[^>]+>/)) {
              overlappingExamples.push({
                surah: surah.number,
                ayah: ayah.numberInSurah,
                word,
                issue: 'nested_rules',
              });
            }
          }
        });
      }
    });
  });

  console.log('\nSummary:');
  console.log(`Total words: ${totalWords}`);
  console.log(`Words with tajweed rules: ${wordsWithRules}`);
  console.log(`Words with multiple rules: ${multipleRuleWords}`);
  console.log(`Total rule start tags: ${ruleStarts}`);
  console.log(`Total rule end tags: ${ruleEnds}`);

  if (ruleStarts !== ruleEnds) {
    console.log('\nWARNING: Mismatched rule tags in the entire dataset!');
  }

  console.log('\nPotential overlapping issues:');
  overlappingExamples.slice(0, 20).forEach((example, index) => {
    console.log(`\nExample ${index + 1}:`);
    console.log(`Surah ${example.surah}, Ayah ${example.ayah}`);
    console.log(`Issue: ${example.issue || 'Mismatched tags'}`);
    console.log(
      `Start tags: ${example.startTags}, End tags: ${example.endTags}`,
    );
    console.log(`Word: ${example.word}`);
  });
} catch (err) {
  console.error('Error:', err);
}
