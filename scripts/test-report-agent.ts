import { detectReportIntent, findBestProject } from '../lib/reportAgent';
import type { Project } from '../types';

const projects = [
  {
    id: 'p-mahakam',
    name: 'Restorasi Mahakam',
    pic: 'Ayu',
    category: 'Mahakam',
    location: 'Kalimantan Timur',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
  {
    id: 'p-blora',
    name: 'Program Blora Hijau',
    pic: 'Bima',
    category: 'Blora',
    location: 'Blora',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
] as Project[];

const intent = detectReportIntent('Danta buat laporan mingguan project Mahakam minggu ini');
if (!intent) throw new Error('Expected report intent to be detected');
if (intent.type !== 'generate-weekly-project-report') throw new Error(`Unexpected intent type ${intent.type}`);

const selected = findBestProject(projects, intent.projectQuery);
if (selected?.id !== 'p-mahakam') {
  throw new Error(`Expected p-mahakam, got ${selected?.id || 'none'}`);
}

const ignored = detectReportIntent('Project mana paling berisiko?');
if (ignored !== null) throw new Error('Risk question should not become report action');

console.log('report agent helpers ok');
