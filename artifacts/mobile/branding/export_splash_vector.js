const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const brandingDir = __dirname;
const assetsDir = path.join(__dirname, '../assets/images');

async function buildNativeAndroidSplash() {
  console.log("Rendering lightweight native Android splash logo (432dp container, 288dp safe core area)...");

  const masterSvgPath = path.join(brandingDir, 'approved_master_logo.svg');
  const masterSvgBuf = fs.readFileSync(masterSvgPath);
  const innerSvgContent = masterSvgBuf.toString().replace(/<\/?svg[^>]*>/g, '');

  // Render 432x432 dp splash container with 288x288 dp (66.6%) safe centered artwork (transparent background)
  const splashContainerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432" width="432" height="432">
    <!-- Safe core area diameter: 288dp (translate: 72, scale: 288/1024 = 0.28125) -->
    <g transform="translate(72, 72) scale(0.28125)">
      ${innerSvgContent}
    </g>
  </svg>`;

  const splashPngBuf = await sharp(Buffer.from(splashContainerSvg))
    .resize(432, 432)
    .png({ compressionLevel: 9, quality: 85 })
    .toBuffer();

  const splashPath = path.join(assetsDir, 'splash.png');
  const splashBrandingPath = path.join(brandingDir, 'splash.png');

  fs.writeFileSync(splashPath, splashPngBuf);
  fs.writeFileSync(splashBrandingPath, splashPngBuf);

  console.log(`- splash.png rendered & installed to assets/images/splash.png (${(splashPngBuf.length / 1024).toFixed(2)} KB)`);
}

buildNativeAndroidSplash().catch(err => {
  console.error("Error generating native splash:", err);
  process.exit(1);
});
