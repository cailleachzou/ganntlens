// 把 seedProjects 拆成 4 个 JSON（project/files/activities/ai-notes）
import { seedProjects } from './src/lib/seed/seedData.ts';
import fs from 'fs';
import path from 'path';

for (const p of seedProjects) {
  const dir = path.join('data/projects', p.id);
  fs.mkdirSync(dir, { recursive: true });
  const { files, activities, aiNotes, ...core } = p;
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ ...core, lastModifiedBy: 'seed', lastModifiedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'files.json'), JSON.stringify({ projectId: p.id, files: files ?? [], lastModifiedBy: 'seed', lastModifiedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'activities.json'), JSON.stringify({ projectId: p.id, activities: activities ?? [], lastModifiedBy: 'seed', lastModifiedAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, 'ai-notes.json'), JSON.stringify({ projectId: p.id, notes: aiNotes ?? [], lastModifiedBy: 'seed', lastModifiedAt: new Date().toISOString() }, null, 2));
  console.log(`✓ ${p.id}: project/files/activities/ai-notes.json`);
}
