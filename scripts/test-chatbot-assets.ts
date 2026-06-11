import assert from 'node:assert/strict';
import {
  assetToSource,
  buildAssetSummary,
  scoreAssetSource,
} from '../lib/chatbotAssetUtils';

const rows = [
  {
    id: 'asset-1',
    file_name: 'mahakam-boundary.zip',
    file_url: 'https://r2.example.com/assets/Mahakam/Shapefile/1710000000000_mahakam-boundary.zip',
    storage_key: 'assets/Mahakam/Shapefile/1710000000000_mahakam-boundary.zip',
    mime_type: 'application/zip',
    file_size: 1024,
    category: 'Mahakam/Shapefile',
    description: 'Batas area Mahakam',
    uploaded_by: 'team@example.com',
    created_at: '2026-06-09T02:00:00.000Z',
    updated_at: '2026-06-09T02:00:00.000Z',
  },
  {
    id: 'asset-2',
    file_name: 'report.pdf',
    file_url: 'https://r2.example.com/assets/Blora/Report/1710000000000_report.pdf',
    storage_key: 'assets/Blora/Report/1710000000000_report.pdf',
    mime_type: 'application/pdf',
    file_size: 2048,
    category: 'Blora/Report',
    description: null,
    uploaded_by: null,
    created_at: '2026-06-08T02:00:00.000Z',
    updated_at: '2026-06-08T02:00:00.000Z',
  },
];

const summary = buildAssetSummary(rows);

assert.equal(summary.totalAssets, 2);
assert.equal(summary.totalSize, 3072);
assert.deepEqual(summary.byLocation, [
  { location: 'Mahakam', count: 1, totalSize: 1024 },
  { location: 'Blora', count: 1, totalSize: 2048 },
]);
assert.equal(summary.recent[0].fileName, 'mahakam-boundary.zip');
assert.equal(summary.recent[0].location, 'Mahakam');
assert.equal(summary.recent[0].folder, 'Shapefile');

const source = assetToSource(summary.items[0]);
assert.equal(source.type, 'asset');
assert.equal(source.title, 'mahakam-boundary.zip');
assert.equal(source.url, rows[0].file_url);
assert.match(source.subtitle, /Mahakam/);
assert.match(source.subtitle, /Shapefile/);
assert(scoreAssetSource(source, ['mahakam'], 'cari asset shapefile R2 Mahakam') > 0);

console.log('chatbot asset helpers ok');
