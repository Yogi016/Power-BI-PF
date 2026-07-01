import assert from 'node:assert/strict';
import {
  buildCooperationTasks,
  buildRoleDocumentInbox,
  COOPERATION_DEMO_DOCUMENTS,
  distributeCooperationDocumentWeights,
  mapCooperationStatusToTaskId,
  redistributeImplementationWeights,
} from '../lib/cooperationWorkflow';

const redistributed = redistributeImplementationWeights(
  [
    { id: 'a', weight: 40 },
    { id: 'b', weight: 35 },
    { id: 'c', weight: 25 },
  ],
  true
);

assert.deepEqual(
  redistributed.map((item) => item.adjustedWeight),
  [32, 28, 20],
  'implementation weights should become 80% proportionally'
);

assert.deepEqual(
  distributeCooperationDocumentWeights([{ id: 'pks' }]),
  { pks: 20 },
  'one cooperation document should receive the full 20% pool'
);

assert.deepEqual(
  distributeCooperationDocumentWeights([{ id: 'mou' }, { id: 'pks' }]),
  { mou: 10, pks: 10 },
  'two cooperation documents should split the 20% pool evenly'
);

assert.deepEqual(
  distributeCooperationDocumentWeights([{ id: 'mou' }, { id: 'pks' }, { id: 'addendum' }]),
  { mou: 6.67, pks: 6.67, addendum: 6.66 },
  'three cooperation documents should split the 20% pool while preserving total 20%'
);

assert.equal(
  mapCooperationStatusToTaskId('menunggu-approval-vp'),
  'approval-vp',
  'waiting VP approval should activate the VP approval task'
);

const vpDocument = COOPERATION_DEMO_DOCUMENTS.find((doc) => doc.status === 'menunggu-approval-vp');
assert.ok(vpDocument, 'demo data should include a VP approval document');

const vpTasks = buildCooperationTasks(vpDocument);
const activeTask = vpTasks.find((task) => task.status === 'in-progress');
assert.equal(activeTask?.id, 'approval-vp', 'VP approval document should have approval-vp in progress');
assert.ok(
  vpTasks.some((task) => task.evidence.some((version) => version.versionLabel === 'Final Draft')),
  'generated tasks should surface document versions as evidence'
);

assert.equal(
  buildRoleDocumentInbox(COOPERATION_DEMO_DOCUMENTS, 'vp_lingkungan').length,
  1,
  'VP inbox should focus on documents waiting for VP approval'
);
assert.equal(
  buildRoleDocumentInbox(COOPERATION_DEMO_DOCUMENTS, 'project_head').length,
  1,
  'Project Head inbox should focus on Project Head review'
);
assert.equal(
  buildRoleDocumentInbox(COOPERATION_DEMO_DOCUMENTS, 'staff_officer').length,
  0,
  'Staff inbox should not include documents outside draft/revision statuses'
);

console.log('cooperation workflow checks passed');
