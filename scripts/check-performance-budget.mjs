import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');
const MAX_APP_CHUNK_BYTES = 1_500_000;
const MAX_TOTAL_JS_BYTES = 4_900_000;

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const jsFiles = readdirSync(ASSETS_DIR)
  .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
  .map((file) => {
    const path = join(ASSETS_DIR, file);
    return {
      file,
      bytes: statSync(path).size,
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const appChunks = jsFiles.filter(({ file }) => (
  !file.startsWith('workbox-') &&
  !file.startsWith('sw') &&
  !file.includes('workbox-window')
));

const largestAppChunk = appChunks[0];
const totalJsBytes = jsFiles.reduce((sum, item) => sum + item.bytes, 0);

console.log('Performance budget report');
console.log('Largest application chunk:', largestAppChunk ? `${largestAppChunk.file} ${formatKb(largestAppChunk.bytes)}` : 'none');
console.log('Total JS:', formatKb(totalJsBytes));
console.log('Top JS chunks:');
for (const item of jsFiles.slice(0, 8)) {
  console.log(`- ${item.file}: ${formatKb(item.bytes)}`);
}

let failed = false;

if (largestAppChunk && largestAppChunk.bytes > MAX_APP_CHUNK_BYTES) {
  console.error(`Largest application chunk exceeds ${formatKb(MAX_APP_CHUNK_BYTES)}.`);
  failed = true;
}

if (totalJsBytes > MAX_TOTAL_JS_BYTES) {
  console.error(`Total JS exceeds ${formatKb(MAX_TOTAL_JS_BYTES)}.`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
