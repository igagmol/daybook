// Generates the PNG app icons from icons-src/icon.svg.
// Usage: npx --yes -p @resvg/resvg-js node scripts/make-icons.mjs   (or: npm run icons)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../icons-src/icon.svg', import.meta.url));
mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: '#D2E4F6' }).render().asPng();
  writeFileSync(new URL(`../icons/${name}`, import.meta.url), png);
  console.log(`icons/${name} (${size}x${size})`);
}
