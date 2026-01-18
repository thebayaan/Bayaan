const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../assets');
const IOS_SPLASH_DIR = path.join(
  __dirname,
  '../ios/Bayaan/Images.xcassets/SplashScreen.imageset',
);
const IOS_CALLIGRAPHY_DIR = path.join(
  __dirname,
  '../ios/Bayaan/Images.xcassets/Calligraphy.imageset',
);
const ANDROID_DIR = path.join(__dirname, '../android/app/src/main/res');

const IOS_SPLASH_SIZES = [
  {suffix: '', scale: 1, width: 390, height: 844},
  {suffix: '@2x', scale: 2, width: 780, height: 1688},
  {suffix: '@3x', scale: 3, width: 1170, height: 2532},
];

const IOS_CALLIGRAPHY_SIZES = [
  {suffix: '', scale: 1, width: 1024, height: 1024},
  {suffix: '@2x', scale: 2, width: 2048, height: 2048},
  {suffix: '@3x', scale: 3, width: 3072, height: 3072},
];

const ANDROID_SPLASH_SIZES = [
  {dir: 'mipmap-mdpi', scale: 1, width: 320, height: 480},
  {dir: 'mipmap-hdpi', scale: 1.5, width: 480, height: 720},
  {dir: 'mipmap-xhdpi', scale: 2, width: 720, height: 1080},
  {dir: 'mipmap-xxhdpi', scale: 3, width: 1080, height: 1620},
  {dir: 'mipmap-xxxhdpi', scale: 4, width: 1440, height: 2160},
];

const ANDROID_CALLIGRAPHY_SIZES = [
  {dir: 'drawable-mdpi', scale: 1},
  {dir: 'drawable-hdpi', scale: 1.5},
  {dir: 'drawable-xhdpi', scale: 2},
  {dir: 'drawable-xxhdpi', scale: 3},
  {dir: 'drawable-xxxhdpi', scale: 4},
];

async function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
}

async function resizeForIOS(inputFile, theme, type = 'splash') {
  const outputDir = type === 'splash' ? IOS_SPLASH_DIR : IOS_CALLIGRAPHY_DIR;
  const sizes = type === 'splash' ? IOS_SPLASH_SIZES : IOS_CALLIGRAPHY_SIZES;
  await ensureDirectoryExists(outputDir);

  for (const size of sizes) {
    const outputFile = path.join(
      outputDir,
      `${type === 'splash' ? 'splash_' : 'calligraphy-'}${theme}${
        size.suffix
      }.png`,
    );
    await sharp(inputFile)
      .resize(size.width, size.height, {
        fit: type === 'splash' ? 'cover' : 'contain',
        position: 'center',
        background: {r: 0, g: 0, b: 0, alpha: 0},
      })
      .toFile(outputFile);
    console.log(`Generated iOS ${theme} ${type}: ${outputFile}`);
  }
}

async function resizeForAndroid(inputFile, theme, type = 'splash') {
  const sizes =
    type === 'splash' ? ANDROID_SPLASH_SIZES : ANDROID_CALLIGRAPHY_SIZES;

  for (const size of sizes) {
    const baseDir = path.join(ANDROID_DIR, size.dir);
    // Fix: Change drawable-hdpi-night to drawable-night-hdpi
    const nightDir = path.join(
      ANDROID_DIR,
      `drawable-night-${size.dir.split('-')[1]}`,
    );

    await ensureDirectoryExists(baseDir);
    if (type === 'calligraphy') {
      await ensureDirectoryExists(nightDir);
    }

    const width =
      type === 'splash' ? size.width : Math.round(1024 * size.scale);
    const height =
      type === 'splash' ? size.height : Math.round(1024 * size.scale);

    const outputFile = path.join(
      theme === 'dark' && type === 'calligraphy' ? nightDir : baseDir,
      `${type === 'splash' ? 'splash_' : 'calligraphy_'}${theme}.png`,
    );

    await sharp(inputFile)
      .resize(width, height, {
        fit: type === 'splash' ? 'cover' : 'contain',
        position: 'center',
        background: {r: 0, g: 0, b: 0, alpha: 0},
      })
      .toFile(outputFile);
    console.log(`Generated Android ${theme} ${type}: ${outputFile}`);
  }
}

async function main() {
  try {
    // Process splash background images
    const lightSplashInput = path.join(
      SOURCE_DIR,
      'splash_background_light.png',
    );
    const darkSplashInput = path.join(SOURCE_DIR, 'splash_background_dark.png');
    await resizeForIOS(lightSplashInput, 'light', 'splash');
    await resizeForIOS(darkSplashInput, 'dark', 'splash');
    await resizeForAndroid(lightSplashInput, 'light', 'splash');
    await resizeForAndroid(darkSplashInput, 'dark', 'splash');

    // Process calligraphy images
    const lightCalligraphyInput = path.join(
      SOURCE_DIR,
      'calligraphy-light.png',
    );
    const darkCalligraphyInput = path.join(SOURCE_DIR, 'calligraphy-dark.png');
    await resizeForIOS(lightCalligraphyInput, 'light', 'calligraphy');
    await resizeForIOS(darkCalligraphyInput, 'dark', 'calligraphy');
    await resizeForAndroid(lightCalligraphyInput, 'light', 'calligraphy');
    await resizeForAndroid(darkCalligraphyInput, 'dark', 'calligraphy');

    console.log(
      'All splash screen and calligraphy images have been generated successfully!',
    );
  } catch (error) {
    console.error('Error generating images:', error);
    process.exit(1);
  }
}

main();
