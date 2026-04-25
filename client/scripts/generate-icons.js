/*
 * Rasterizes the Whatchat SVG logo into every PNG size the app / store need.
 *
 *   client/assets/images/icon.png                 (1024x1024) → Expo app icon
 *   client/assets/images/adaptive-icon-fg.png     (1024x1024) → Android adaptive foreground
 *   client/assets/images/splash-icon.png          (1024x1024) → splash screen
 *   client/assets/images/favicon.png              (256x256)   → web favicon
 *   client/assets/store/play-feature-graphic.png  (1024x500)  → Play Store feature graphic
 *   client/assets/store/play-icon-512.png         (512x512)   → Play Store high-res icon
 *
 * Requires `sharp`. Run:
 *   npm i -D sharp
 *   node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Missing dep: install with `npm i -D sharp`');
    process.exit(1);
  }

  const root = path.resolve(__dirname, '..');
  const svgIcon = fs.readFileSync(path.join(root, 'assets/images/logo/whatchat-icon.svg'));
  const svgFg = fs.readFileSync(path.join(root, 'assets/images/logo/whatchat-foreground.svg'));
  const svgGraphic = fs.readFileSync(path.join(root, 'assets/images/logo/whatchat-feature-graphic.svg'));

  const storeDir = path.join(root, 'assets/store');
  fs.mkdirSync(storeDir, { recursive: true });

  const jobs = [
    { svg: svgIcon, out: 'assets/images/icon.png', size: [1024, 1024] },
    { svg: svgFg, out: 'assets/images/adaptive-icon-fg.png', size: [1024, 1024] },
    { svg: svgIcon, out: 'assets/images/splash-icon.png', size: [1024, 1024] },
    { svg: svgIcon, out: 'assets/images/favicon.png', size: [256, 256] },
    { svg: svgIcon, out: 'assets/store/play-icon-512.png', size: [512, 512] },
    { svg: svgGraphic, out: 'assets/store/play-feature-graphic.png', size: [1024, 500] },
  ];

  for (const job of jobs) {
    const abs = path.join(root, job.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await sharp(job.svg, { density: 384 })
      .resize(job.size[0], job.size[1], { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(abs);
    console.log(`  ✓ ${job.out} (${job.size.join('x')})`);
  }

  console.log('\nDone. Don\'t forget to update app.config.ts to point at icon.png.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
