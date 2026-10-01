import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectProjects } from './content-policy.mjs';

test('selected games stay visible, excluded and unknown projects stay out', () => {
  const fixture = ['acid-uno', 'neon-lines', 'stealth', 'knb', 'perelom', 'neon-claw', 'unknown'].map(id => ({ id }));
  assert.deepEqual(selectProjects(fixture, 'games').map(p => p.id), ['acid-uno', 'neon-lines', 'stealth']);
});
test('QueQuest is the first work case and also belongs to games', () => {
  const fixture = [{id:'local-agent-gateway'}, {id:'qa-quest'}, {id:'psy-ai-admin'}, {id:'buddhist-diary-bot'}];
  assert.deepEqual(selectProjects(fixture, 'work').map(p => p.id), ['qa-quest', 'local-agent-gateway']);
  assert.deepEqual(selectProjects(fixture, 'games').map(p => p.id), ['qa-quest']);
});
