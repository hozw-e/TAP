// One-time helper to generate PWA icons from public/logo.png.
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const src = path.join(publicDir, 'logo.png');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function run() {
  // Standard "any" icons: logo centered on a white square.
  for (const size of [192, 512]) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toFile(path.join(publicDir, `pwa-${size}x${size}.png`));
    console.log(`wrote pwa-${size}x${size}.png`);
  }

  // Maskable icon: logo shrunk to ~70% inside a white safe area so Android's
  // circle/rounded-rect masks never clip the logo.
  const maskSize = 512;
  const inner = Math.round(maskSize * 0.7);
  const resizedLogo = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskSize,
      height: maskSize,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('wrote pwa-maskable-512x512.png');

  // Apple touch icon (180x180) for iOS home-screen.
  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('wrote apple-touch-icon.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
