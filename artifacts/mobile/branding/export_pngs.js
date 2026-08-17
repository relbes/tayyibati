const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const brandingDir = __dirname;

async function exportAssets() {
  console.log("Rendering production PNG assets from SVG vector sources...");

  // 1. Master Logo (1024x1024 transparent)
  const masterSvg = fs.readFileSync(path.join(brandingDir, 'master_logo.svg'));
  await sharp(masterSvg)
    .resize(1024, 1024)
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandingDir, 'master_logo.png'));
  console.log("Master Logo rendered: master_logo.png");

  // 2. Android Adaptive Icon Foreground (1024x1024 transparent within 66% safe zone)
  // Adaptive icon safe zone is middle 66% of the 1024 canvas (approx 680px)
  const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <g transform="translate(172, 172) scale(0.664)">
      ${masterSvg.toString().replace(/<\/?svg[^>]*>/g, '')}
    </g>
  </svg>`;
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandingDir, 'adaptive_icon_foreground.png'));
  console.log("Adaptive Icon Foreground rendered: adaptive_icon_foreground.png");

  // 3. Play Store Icon (512x512 opaque #1B7A5E background)
  const playSvg = fs.readFileSync(path.join(brandingDir, 'play_store_icon.svg'));
  await sharp(playSvg)
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandingDir, 'play_store_icon.png'));
  console.log("Play Store Icon rendered: play_store_icon.png");

  // 4. Splash Logo (512x512 transparent)
  const splashSvg = fs.readFileSync(path.join(brandingDir, 'splash_logo.svg'));
  await sharp(splashSvg)
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(brandingDir, 'splash_logo.png'));
  console.log("Splash Logo rendered: splash_logo.png");

  // Log file sizes
  const files = ['master_logo.png', 'adaptive_icon_foreground.png', 'play_store_icon.png', 'splash_logo.png'];
  console.log("\nExported Asset File Sizes:");
  for (const f of files) {
    const stats = fs.statSync(path.join(brandingDir, f));
    console.log(`- ${f}: ${(stats.size / 1024).toFixed(2)} KB`);
  }
}

exportAssets().catch(err => {
  console.error("Error exporting PNGs:", err);
  process.exit(1);
});
