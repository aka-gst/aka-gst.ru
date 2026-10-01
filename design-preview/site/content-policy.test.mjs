import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectProjects } from './content-policy.mjs';

test('selected games stay visible, excluded and unknown projects stay out', () => {
  const fixture = ['acid-uno', 'neon-lines', 'stealth', 'knb', 'perelom', 'neon-claw', 'unknown'].map(id => ({ id }));
  assert.deepEqual(selectProjects(fixture, 'games').map(p => p.id), ['acid-uno', 'neon-lines', 'stealth']);
});
test('Gateway and Dharma lead work; QueQuest remains a game', () => {
  const fixture = [{id:'local-agent-gateway'}, {id:'qa-quest'}, {id:'dharma-ai'}, {id:'psy-ai-admin'}, {id:'buddhist-diary-bot'}];
  assert.deepEqual(selectProjects(fixture, 'work').map(p => p.id), ['local-agent-gateway', 'dharma-ai', 'qa-quest']);
  assert.deepEqual(selectProjects(fixture, 'games').map(p => p.id), ['qa-quest']);
});

test('new selected games lead the unified catalogue', () => {
 const fixture=['technomagic','black-ice','afterflow-prism','acid-uno','pythonio','pulse-arena','sdvig-21','glubina','perelom'].map(id=>({id}));
 assert.deepEqual(selectProjects(fixture,'games').map(p=>p.id),['black-ice','afterflow-prism','acid-uno','pythonio','pulse-arena','sdvig-21','technomagic','glubina']);
});
