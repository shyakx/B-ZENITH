import sharp from "sharp";
import fs from "fs";
import path from "path";

const root = process.cwd();
const brand = path.join(root, "public/brand");
const appDir = path.join(root, "src/app");
const src = fs.existsSync(path.join(brand, "logo-source.png"))
  ? path.join(brand, "logo-source.png")
  : path.join(brand, "logo.png");

async function writePng(size, out) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(out);
  console.log(path.relative(root, out), fs.statSync(out).size);
}

async function writeIco(sizes, outPath) {
  const images = [];
  for (const size of sizes) {
    const buf = await sharp(src)
      .resize(size, size, { fit: "cover" })
      .ensureAlpha()
      .png({ compressionLevel: 9, force: true })
      .toBuffer();
    images.push({ size, buf });
  }
  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const entries = [];
  for (const img of images) {
    entries.push({ size: img.size, buf: img.buf, offset });
    offset += img.buf.length;
  }
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(images.length, 4);
  let entryOffset = 6;
  for (const e of entries) {
    out.writeUInt8(e.size >= 256 ? 0 : e.size, entryOffset);
    out.writeUInt8(e.size >= 256 ? 0 : e.size, entryOffset + 1);
    out.writeUInt8(0, entryOffset + 2);
    out.writeUInt8(0, entryOffset + 3);
    out.writeUInt16LE(1, entryOffset + 4);
    out.writeUInt16LE(32, entryOffset + 6);
    out.writeUInt32LE(e.buf.length, entryOffset + 8);
    out.writeUInt32LE(e.offset, entryOffset + 12);
    e.buf.copy(out, e.offset);
    entryOffset += 16;
  }
  fs.writeFileSync(outPath, out);
  console.log(path.relative(root, outPath), out.length);
}

await writePng(256, path.join(brand, "logo-mark.png"));
await writePng(32, path.join(brand, "icon-32.png"));
await writePng(192, path.join(brand, "icon-192.png"));
await writePng(512, path.join(brand, "icon-512.png"));
await writePng(180, path.join(brand, "apple-touch-icon.png"));

await sharp(src)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(brand, "logo-display.png"));
console.log("logo-display", fs.statSync(path.join(brand, "logo-display.png")).size);

await sharp(src)
  .resize(32, 32, { fit: "cover" })
  .ensureAlpha()
  .png({ compressionLevel: 9, force: true })
  .toFile(path.join(appDir, "icon.png"));
await sharp(src)
  .resize(180, 180, { fit: "cover" })
  .ensureAlpha()
  .png({ compressionLevel: 9, force: true })
  .toFile(path.join(appDir, "apple-icon.png"));

const faviconPath = path.join(root, "public/favicon.ico");
try {
  const toIco = (await import("to-ico")).default;
  const pngs = [];
  for (const size of [16, 32, 48]) {
    pngs.push(
      await sharp(src)
        .resize(size, size, { fit: "cover" })
        .ensureAlpha()
        .png({ force: true })
        .toBuffer(),
    );
  }
  fs.writeFileSync(faviconPath, await toIco(pngs));
  console.log("favicon.ico (to-ico)", fs.statSync(faviconPath).size);
} catch {
  await writeIco([16, 32, 48], faviconPath);
}

const mark = await sharp(src).resize(360, 360, { fit: "cover" }).png().toBuffer();
const svg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a1810"/>
      <stop offset="100%" stop-color="#5c3822"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="520" y="290" fill="#faf6f1" font-family="Georgia, serif" font-size="72" font-weight="700">B-ZENITH</text>
  <text x="520" y="350" fill="#c4a574" font-family="Arial, sans-serif" font-size="28">Restaurant · Bar · Cafe POS</text>
  <text x="520" y="400" fill="#e4d6c8" font-family="Arial, sans-serif" font-size="22">Orders, billing and inventory</text>
</svg>`);

await sharp(svg)
  .composite([{ input: mark, top: 135, left: 120 }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(brand, "og.png"));

await sharp(path.join(brand, "og.png"))
  .jpeg({ quality: 82 })
  .toFile(path.join(appDir, "opengraph-image.jpg"));

console.log(
  "og",
  fs.statSync(path.join(brand, "og.png")).size,
  fs.statSync(path.join(appDir, "opengraph-image.jpg")).size,
);
console.log("done");
