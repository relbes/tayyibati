const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const mobileRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(mobileRoot, 'assets/images');
const brandingDir = path.join(mobileRoot, 'branding');
const androidResDir = path.join(mobileRoot, 'android/app/src/main/res');

// Background color constant
const BG_COLOR = { r: 250, g: 249, b: 234, alpha: 1 }; // #FAF9EA

async function run() {
  console.log('=== TAYYIBATI SPLASH SCREEN LOGO RESIZE (35% INCREASE) ===\n');

  // Step 1: Extract master logo artwork from current assets/images/splash.png
  // Current bounding box: minX: 192, minY: 710, width: 900, height: 1024
  const sourceSplashPath = path.join(assetsDir, 'splash.png');
  console.log('1. Reading source splash asset:', sourceSplashPath);

  const rawLogoBuffer = await sharp(sourceSplashPath)
    .extract({ left: 192, top: 710, width: 900, height: 1024 })
    .toBuffer();

  const originalAspect = 900 / 1024;
  console.log(`- Extracted master logo: 900x1024 (aspect: ${originalAspect.toFixed(4)})\n`);

  // Target increase: 35% (1.35x)
  const SCALE_FACTOR = 1.35;

  // Step 2: Generate new assets/images/splash.png (Canvas: 1284 x 2778)
  const newSplashWidth = Math.round(900 * SCALE_FACTOR); // 1215 px
  const newSplashHeight = Math.round(1024 * SCALE_FACTOR); // 1382 px

  console.log(`2. Resizing for assets/images/splash.png:`);
  console.log(`   New logo dimensions: ${newSplashWidth} x ${newSplashHeight} (+35.0%)`);
  console.log(`   Canvas dimensions: 1284 x 2778`);

  const resizedSplashLogo = await sharp(rawLogoBuffer)
    .resize(newSplashWidth, newSplashHeight, { kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  const splashCanvasLeft = Math.round((1284 - newSplashWidth) / 2); // 34 or 35 px
  const splashCanvasTop = Math.round((2778 - newSplashHeight) / 2); // 698 px

  const finalSplashPng = await sharp({
    create: {
      width: 1284,
      height: 2778,
      channels: 3,
      background: { r: 250, g: 249, b: 234 }
    }
  })
  .composite([{
    input: resizedSplashLogo,
    left: splashCanvasLeft,
    top: splashCanvasTop
  }])
  .png({ compressionLevel: 9 })
  .toBuffer();

  fs.writeFileSync(sourceSplashPath, finalSplashPng);
  console.log(`   ✓ Written: assets/images/splash.png (${(finalSplashPng.length / 1024).toFixed(1)} KB)`);

  // Step 3: Update branding/splash.png (Canvas: 1242 x 2436)
  // On 1242 canvas, fit logo keeping original ratio
  // 35% increase from old branding logo (which was 286x361): 286 * 1.35 = 386 x 487 (or matching proportions)
  const brandingLogoW = Math.round(286 * SCALE_FACTOR);
  const brandingLogoH = Math.round(361 * SCALE_FACTOR);
  const resizedBrandingLogo = await sharp(rawLogoBuffer)
    .resize(brandingLogoW, brandingLogoH, { kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  const finalBrandingPng = await sharp({
    create: {
      width: 1242,
      height: 2436,
      channels: 3,
      background: { r: 250, g: 249, b: 234 }
    }
  })
  .composite([{
    input: resizedBrandingLogo,
    left: Math.round((1242 - brandingLogoW) / 2),
    top: Math.round((2436 - brandingLogoH) / 2)
  }])
  .png({ compressionLevel: 9 })
  .toBuffer();

  fs.writeFileSync(path.join(brandingDir, 'splash.png'), finalBrandingPng);
  console.log(`   ✓ Written: branding/splash.png (${(finalBrandingPng.length / 1024).toFixed(1)} KB)\n`);

  // Step 4: Generate Android native drawables for all densities
  // Original base sizes at mdpi (multiplier 1): 66 x 74 -> +35% = 89 x 100
  const densities = [
    { name: 'mdpi', canvas: 288, multiplier: 1, baseW: 66, baseH: 74 },
    { name: 'hdpi', canvas: 432, multiplier: 1.5, baseW: 99, baseH: 112 },
    { name: 'xhdpi', canvas: 576, multiplier: 2, baseW: 131, baseH: 148 },
    { name: 'xxhdpi', canvas: 864, multiplier: 3, baseW: 195, baseH: 222 },
    { name: 'xxxhdpi', canvas: 1152, multiplier: 4, baseW: 260, baseH: 296 }
  ];

  console.log('3. Updating Android native drawable splashscreen_logo.png for all 5 densities:');

  for (const d of densities) {
    const targetW = Math.round(d.baseW * SCALE_FACTOR);
    const targetH = Math.round(d.baseH * SCALE_FACTOR);
    const left = Math.round((d.canvas - targetW) / 2);
    const top = Math.round((d.canvas - targetH) / 2);

    const resizedLogo = await sharp(rawLogoBuffer)
      .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
      .toBuffer();

    const finalDrawable = await sharp({
      create: {
        width: d.canvas,
        height: d.canvas,
        channels: 4,
        background: BG_COLOR
      }
    })
    .composite([{
      input: resizedLogo,
      left,
      top
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();

    const destDir = path.join(androidResDir, `drawable-${d.name}`);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destFile = path.join(destDir, 'splashscreen_logo.png');
    fs.writeFileSync(destFile, finalDrawable);

    const actualAspect = targetW / targetH;
    console.log(`   ✓ ${d.name.padEnd(8)} Canvas: ${d.canvas}x${d.canvas} | Logo: ${targetW}x${targetH} (was ${d.baseW}x${d.baseH}) | Pos: (${left}, ${top}) | Aspect: ${actualAspect.toFixed(4)}`);
  }

  console.log('\n=== ALL SPLASH SCREEN LOGO ASSETS SUCCESSFULLY GENERATED ===');
}

run().catch(err => {
  console.error('Fatal error during splash resize:', err);
  process.exit(1);
});
