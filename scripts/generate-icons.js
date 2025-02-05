const sharp = require('sharp');
const path = require('path');

const androidSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const sourceIcon = path.join(__dirname, '../assets/images/app_icon.png');

// Generate Android icons
Object.entries(androidSizes).forEach(([density, size]) => {
  const outputPath = path.join(
    __dirname,
    `../android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
  );
  const outputPathRound = path.join(
    __dirname,
    `../android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`,
  );

  sharp(sourceIcon)
    .resize(size, size)
    .toFile(outputPath)
    .then(() => console.log(`Generated ${outputPath}`))
    .catch(err => console.error(`Error generating ${outputPath}:`, err));

  sharp(sourceIcon)
    .resize(size, size)
    .toFile(outputPathRound)
    .then(() => console.log(`Generated ${outputPathRound}`))
    .catch(err => console.error(`Error generating ${outputPathRound}:`, err));
});

// Generate iOS icons
const iosIcon = path.join(
  __dirname,
  '../ios/Bayaan/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png',
);
sharp(sourceIcon)
  .resize(1024, 1024)
  .toFile(iosIcon)
  .then(() => console.log(`Generated ${iosIcon}`))
  .catch(err => console.error(`Error generating ${iosIcon}:`, err));
