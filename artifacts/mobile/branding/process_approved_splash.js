const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const approvedSplashSrc = 'C:/Users/r_elbes/.gemini/antigravity/brain/4e4d60b4-f7a2-411a-a1df-1d0bda1aa4a8/tayyibati_splash_production_preview_1786949810787.jpg';
const destSplashPng = 'C:/Users/r_elbes/Documents/New project/tayyibati/artifacts/mobile/assets/images/splash.png';
const brandingSplashPng = 'C:/Users/r_elbes/Documents/New project/tayyibati/artifacts/mobile/branding/splash.png';

async function processApprovedSplash() {
  console.log("Processing approved user splash preview image:", approvedSplashSrc);
  const meta = await sharp(approvedSplashSrc).metadata();
  console.log(`Source dimensions: ${meta.width} x ${meta.height}, size: ${(fs.statSync(approvedSplashSrc).size / 1024).toFixed(2)} KB`);

  // Crop the central logo artwork region (top 20% to 75%)
  const cropWidth = Math.round(meta.width * 0.8);
  const cropHeight = Math.round(meta.height * 0.55);
  const cropLeft = Math.round((meta.width - cropWidth) / 2);
  const cropTop = Math.round(meta.height * 0.22);

  const croppedBuffer = await sharp(approvedSplashSrc)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .toBuffer();

  // Resize cropped artwork to fit inside 288x288 dp safe inner region
  const logoResized = await sharp(croppedBuffer)
    .resize({ width: 288, height: 288, fit: 'inside' })
    .toBuffer();

  const resizedMeta = await sharp(logoResized).metadata();

  // Composite centered logo onto 432x432 dp container canvas with transparent background
  const splashFinal = await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{
    input: logoResized,
    top: Math.round((432 - resizedMeta.height) / 2),
    left: Math.round((432 - resizedMeta.width) / 2)
  }])
  .png({ compressionLevel: 9, quality: 90 })
  .toBuffer();

  fs.writeFileSync(destSplashPng, splashFinal);
  fs.writeFileSync(brandingSplashPng, splashFinal);

  console.log(`- Successfully created splash.png (${(splashFinal.length / 1024).toFixed(2)} KB, 432x432 container, safe 288dp centered logo)`);
}

processApprovedSplash().catch(err => {
  console.error("Error processing splash:", err);
  process.exit(1);
});
