const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const brandingDir = __dirname;
const assetsDir = path.join(__dirname, '../assets/images');

async function buildApprovedBranding() {
  console.log("Rendering production branding assets from approved master SVG source...");

  const masterSvgPath = path.join(brandingDir, 'approved_master_logo.svg');
  const masterSvgBuf = fs.readFileSync(masterSvgPath);

  // 1. App Icon (1024x1024 with clean light cream background #F7F9F6)
  const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <rect width="1024" height="1024" rx="220" fill="#F7F9F6"/>
    <g transform="translate(102, 102) scale(0.8)">
      ${masterSvgBuf.toString().replace(/<\/?svg[^>]*>/g, '')}
    </g>
  </svg>`;

  const iconPngBuf = await sharp(Buffer.from(appIconSvg))
    .resize(1024, 1024)
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();

  fs.writeFileSync(path.join(brandingDir, 'icon.png'), iconPngBuf);
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPngBuf);
  console.log(`- icon.png rendered & installed to assets/images/icon.png (${(iconPngBuf.length / 1024).toFixed(2)} KB)`);

  // 2. Android Adaptive Icon Foreground (1024x1024 transparent within 66% safe diameter)
  const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <g transform="translate(172, 172) scale(0.664)">
      ${masterSvgBuf.toString().replace(/<\/?svg[^>]*>/g, '')}
    </g>
  </svg>`;

  const adaptivePngBuf = await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();

  fs.writeFileSync(path.join(brandingDir, 'adaptive_icon_foreground.png'), adaptivePngBuf);
  console.log(`- adaptive_icon_foreground.png rendered (${(adaptivePngBuf.length / 1024).toFixed(2)} KB)`);

  // 3. Play Store Icon (512x512 opaque #F7F9F6 background)
  const playStorePngBuf = await sharp(Buffer.from(appIconSvg))
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();

  fs.writeFileSync(path.join(brandingDir, 'play_store_icon.png'), playStorePngBuf);
  console.log(`- play_store_icon.png rendered (${(playStorePngBuf.length / 1024).toFixed(2)} KB)`);

  // 4. Splash Screen Logo Asset (512x512 transparent logo asset)
  const splashLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="512" height="512">
    ${masterSvgBuf.toString().replace(/<\/?svg[^>]*>/g, '')}
  </svg>`;

  const splashPngBuf = await sharp(Buffer.from(splashLogoSvg))
    .resize(512, 512)
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();

  fs.writeFileSync(path.join(brandingDir, 'splash.png'), splashPngBuf);
  fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashPngBuf);
  console.log(`- splash.png rendered & installed to assets/images/splash.png (${(splashPngBuf.length / 1024).toFixed(2)} KB)`);

  console.log("\nAll production branding assets built successfully!");
}

buildApprovedBranding().catch(err => {
  console.error("Error building approved branding:", err);
  process.exit(1);
});
