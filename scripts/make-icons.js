// Renders the app icon (cream plate ring + brass dot on ink, same as www/icons/icon.svg) and the
// launch screens to PNG without dependencies.
// Usage: node scripts/make-icons.js
//   www/icons/icon-*.png      PWA / home-screen icons
//   assets/icon-only.png      1024px source for the iOS/Android app icon (@capacitor/assets)
//   assets/splash(-dark).png  2732px launch screens (@capacitor/assets)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const INK = [0x1b, 0x19, 0x16], CREAM = [0xf4, 0xef, 0xe6], BRASS_HI = [0xf0, 0xd0, 0x8f], BRASS = [0xa9, 0x77, 0x2c];

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// logo: fraction of the image width the 512-unit logo artwork occupies
function render(size, logo = 1) {
  const s = size * logo / 512, cx = size / 2, ss = size > 1100 ? 2 : 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = x + (sx + .5) / ss - cx, py = y + (sy + .5) / ss - cx;
        const d = Math.hypot(px, py) / s;
        let c = INK;
        if (d <= 66) { // brass dot with a diagonal gradient
          const t = Math.min(1, Math.max(0, ((px + py) / s / 132 + 1) / 2));
          c = BRASS_HI.map((v, i) => v + (BRASS[i] - v) * t);
        } else if (d >= 132 && d <= 168) c = CREAM;
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 3 + 1) + 1 + x * 3, n = ss * ss;
      raw[o] = r / n; raw[o + 1] = g / n; raw[o + 2] = b / n;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.join(__dirname, '..');
const icons = path.join(root, 'www', 'icons');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });
for (const size of [180, 192, 512, 1024]) {
  fs.writeFileSync(path.join(icons, `icon-${size}.png`), render(size));
  console.log(`www/icons/icon-${size}.png`);
}
fs.copyFileSync(path.join(icons, 'icon-1024.png'), path.join(assets, 'icon-only.png'));
console.log('assets/icon-only.png');
const splash = render(2732, .26); // small centred logo; the web opening animation continues from it
fs.writeFileSync(path.join(assets, 'splash.png'), splash);
fs.writeFileSync(path.join(assets, 'splash-dark.png'), splash);
console.log('assets/splash.png, assets/splash-dark.png');
