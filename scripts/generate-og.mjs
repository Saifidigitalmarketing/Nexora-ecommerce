// Renders the default social-sharing image (Open Graph / X card), 1200×630,
// from the NEXORA brand mark and design tokens. Run: node scripts/generate-og.mjs
// Needs Plus Jakarta Sans + Inter installed for fontconfig (e.g. from @fontsource).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f9f9ff"/>
  <rect x="0" y="0" width="1200" height="12" fill="#006948"/>
  <circle cx="1080" cy="540" r="260" fill="#85f8c4" opacity="0.25"/>
  <circle cx="1130" cy="110" r="120" fill="#006948" opacity="0.06"/>
  <g transform="translate(96 150)">
    <rect width="168" height="168" rx="37" fill="#006948"/>
    <path d="M51.3 118.1V49.9h13.1l39.4 46.6V49.9h13.1v68.2h-13.1L64.4 71.6v46.5z" fill="#ffffff"/>
    <circle cx="116.8" cy="45.9" r="7.2" fill="#85f8c4"/>
  </g>
  <text x="300" y="268" font-family="Plus Jakarta Sans" font-weight="800" font-size="104" letter-spacing="3" fill="#151c27">NEXORA</text>
  <text x="304" y="322" font-family="Plus Jakarta Sans" font-weight="700" font-size="38" fill="#006948">Everything. One Place.</text>
  <text x="96" y="452" font-family="Inter" font-weight="500" font-size="32" fill="#151c27">Electronics · Fashion · Beauty · Home · Pantry</text>
  <text x="96" y="506" font-family="Inter" font-weight="400" font-size="28" fill="#575e70">Cash on Delivery, Easypaisa &amp; JazzCash · Delivery across Pakistan</text>
</svg>`;

await mkdir("public/og", { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile("public/og/nexora-og.png");
console.log("wrote public/og/nexora-og.png");
