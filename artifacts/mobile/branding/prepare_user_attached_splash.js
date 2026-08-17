const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const attachedSplashSrc = 'C:/Users/r_elbes/.gemini/antigravity/brain/4e4d60b4-f7a2-411a-a1df-1d0bda1aa4a8/.user_uploaded/media_1786955982629.png';
const destSplashPng = 'C:/Users/r_elbes/Documents/New project/tayyibati/artifacts/mobile/assets/images/splash.png';
const brandingSplashPng = 'C:/Users/r_elbes/Documents/New project/tayyibati/artifacts/mobile/branding/splash.png';

async function prepareUserSplash() {
  console.log("Processing exact user-attached splash image:", attachedSplashSrc);
  const meta = await sharp(attachedSplashSrc).metadata();
  console.log(`Source image: ${meta.width} x ${meta.height}, size: ${(fs.statSync(attachedSplashSrc).size / 1024).toFixed(2)} KB`);

  // Extract central artwork (logo emblem + text) from the 540x960 image
  const cropW = Math.round(meta.width * 0.75); // ~405px
  const cropH = Math.round(meta.height * 0.40); // ~384px
  const cropL = Math.round((meta.width - cropW) / 2);
  const cropT = Math.round((meta.height - cropH) / 2);

  const logoCropped = await sharp(attachedSplashSrc)
    .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
    .toBuffer();

  // Resize logo artwork to fit safely inside 288x288 dp inner core circle
  const logoScaled = await sharp(logoCropped)
    .resize({ width: 288, height: 288, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const logoMeta = await sharp(logoScaled).metadata();

  // Composite centered logo onto 432x432 dp container canvas with transparent background
  const splashContainer = await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{
    input: logoScaled,
    top: Math.round((432 - logoMeta.height) / 2),
    left: Math.round((432 - logoMeta.width) / 2)
  }])
  .png({ compressionLevel: 9, quality: 90 })
  .toBuffer();

  fs.writeFileSync(destSplashPng, splashContainer);
  fs.writeFileSync(brandingSplashPng, splashContainer);

  console.log(`- Created splash.png (${(splashContainer.length / 1024).toFixed(2)} KB, 432x432 container, safe 288dp centered artwork)`);
}

prepareUserSplash().catch(err => {
  console.error("Error processing user splash:", err);
  process.exit(1);
});
