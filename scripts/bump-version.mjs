// Bumps the app version in config.js and sw.js so installed copies update.
// Usage: node scripts/bump-version.mjs [patch|minor|major|x.y.z]   (default: patch)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const configPath = new URL('config.js', root);
const swPath = new URL('sw.js', root);

const config = readFileSync(configPath, 'utf8');
const current = config.match(/VERSION = "(\d+)\.(\d+)\.(\d+)"/);
if (!current) throw new Error('VERSION not found in config.js');
let [maj, min, pat] = current.slice(1).map(Number);
const arg = process.argv[2] || 'patch';
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else if (arg === 'major') next = `${maj + 1}.0.0`;
else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

writeFileSync(configPath, config.replace(/VERSION = "[^"]*"/, `VERSION = "${next}"`));
const sw = readFileSync(swPath, 'utf8');
if (!/const VERSION = '[^']*'/.test(sw)) throw new Error('VERSION not found in sw.js');
writeFileSync(swPath, sw.replace(/const VERSION = '[^']*'/, `const VERSION = '${next}'`));
console.log(`Version ${current[0].split('"')[1]} -> ${next}`);
