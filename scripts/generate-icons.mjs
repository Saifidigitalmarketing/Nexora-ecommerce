// Rasterises the SVG brand marks into the PNG sizes required by the PWA
// manifest, Apple touch icon and favicon. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const mark = await readFile("public/brand/nexora-mark.svg");
const maskable = await readFile("public/icons/maskable.svg");

const jobs = [
  [mark, 192, "public/icons/icon-192.png"],
  [mark, 512, "public/icons/icon-512.png"],
  [maskable, 192, "public/icons/maskable-192.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [maskable, 180, "public/icons/apple-touch-icon.png"],
  [mark, 32, "public/icons/favicon-32.png"],
];
for (const [svg, size, out] of jobs) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
