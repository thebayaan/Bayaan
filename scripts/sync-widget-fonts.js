// scripts/sync-widget-fonts.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const copies = [
  [
    'data/mushaf/digitalkhatt/DigitalKhattFont.otf',
    'targets/widgets/DigitalKhattFont.otf',
  ],
  ['assets/fonts/surah_names.ttf', 'targets/widgets/surah_names.ttf'],
  [
    'data/mushaf/digitalkhatt/DigitalKhattFont.otf',
    'modules/bayaan-widgets/android/src/main/assets/fonts/DigitalKhattFont.otf',
  ],
  [
    'assets/fonts/surah_names.ttf',
    'modules/bayaan-widgets/android/src/main/assets/fonts/surah_names.ttf',
  ],
  [
    'assets/fonts/ScheherazadeNew-Regular.ttf',
    'targets/widgets/ScheherazadeNew-Regular.ttf',
  ],
  [
    'assets/fonts/ScheherazadeNew-Regular.ttf',
    'modules/bayaan-widgets/android/src/main/assets/fonts/ScheherazadeNew-Regular.ttf',
  ],
];

for (const [from, to] of copies) {
  fs.mkdirSync(path.dirname(path.join(root, to)), {recursive: true});
  fs.copyFileSync(path.join(root, from), path.join(root, to));
}
console.log('[sync-widget-fonts] copied', copies.length, 'fonts');
