import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, STEPS, GROUPS, personaOf, agentOf, jwtDecode } from '../src/flow.js';

test('24 steps, owner-approved labels, groups cover 1-24 without gaps', () => {
  assert.equal(STEPS.length, 24);
  for (const s of STEPS) { assert.ok(s.label && s.what && s.why, s.label); }
  const seen = new Set();
  for (const g of GROUPS) for (let i = g.from; i <= g.to; i++) seen.add(i);
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 1));
  assert.equal(STEPS[19].label, 'Resource Server result returns to MCP Server');
  assert.equal(STEPS[23].label, 'Agent shows the result in the Application');
});

test('write cycle: deny with identifier -> JSON-RPC rewrite -> approve -> replay permits -> used identifier denies', async () => {
  const f = createFlow();
  const first = await f.writeCall();
  assert.equal(first.outcome, 'hitl_required');
  assert.equal(first.decision.result, 'DENY');
  assert.ok(first.identifier);
  // the gateway rewrite: the raw 403 became a JSON-RPC 2.0 error carrying the SAME identifier
  assert.equal(first.rpcError.error.code, -32001);
  assert.equal(first.rpcError.error.data.identifier, first.identifier);
  // the OBO token: sub = person, act = agent, full scopes kept
  const obo = jwtDecode(first.obo.token);
  assert.equal(obo.sub, personaOf().sub);
  assert.equal(obo.act.sub, agentOf().clientId);
  assert.ok(obo.scope.includes('api:write'), 'the OBO token does NOT narrow per tool');
  // replay without approval denies again
  const noApproval = await f.writeCall({ identifierHeader: first.identifier });
  assert.equal(noApproval.outcome, 'hitl_required');
  // approve, replay -> permit, tool runs
  assert.equal(f.approve(first.identifier), true);
  const permit = await f.writeCall({ identifierHeader: first.identifier });
  assert.equal(permit.outcome, 'permit');
  assert.equal(permit.decision.result, 'PERMIT');
  assert.equal(permit.mcp.status, 200);
  assert.equal(permit.mcp.result.by, agentOf().clientId);
  assert.equal(permit.mcp.result.for, personaOf().sub);
  // single use: the same identifier again is denied
  const again = await f.writeCall({ identifierHeader: first.identifier });
  assert.equal(again.outcome, 'hitl_required');
});

test('denied CIBA never permits the replay', async () => {
  const f = createFlow();
  const first = await f.writeCall();
  f.denyCiba(first.identifier);
  const replay = await f.writeCall({ identifierHeader: first.identifier });
  assert.equal(replay.outcome, 'hitl_required');
});

test('a forged identifier (never issued) denies', async () => {
  const f = createFlow();
  const replay = await f.writeCall({ identifierHeader: 'ciba-999' });
  assert.equal(replay.outcome, 'hitl_required');
});

test('disabled agent client fails at step 5', async () => {
  const f = createFlow();
  f.disableAgentClient();
  const r = await f.writeCall();
  assert.equal(r.ok, false);
  assert.equal(r.failedStep, 5);
});

test('diagram: valid diagram-studio/1, 24 steps, cast tokens all defined', async () => {
  const { loadDiagram, DIAGRAM_NAMES } = await import('../src/diagramData.js');
  const { validateDiagram } = await import('../src/diagramStudioValidate.js');
  assert.deepEqual(DIAGRAM_NAMES, ['ciba-hitl']);
  const d = loadDiagram('ciba-hitl');
  assert.deepEqual(validateDiagram(d), []);
  assert.equal(d.steps.length, 24);
  assert.equal(d.edges.length, 24);
  // every step's edges point at real edges; step titles are the owner-approved scenario titles
  const titles = JSON.parse((await import('node:fs')).readFileSync(new URL('../data/scenarios.json', import.meta.url), 'utf8')).steps.map((s) => s.title);
  assert.deepEqual(d.steps.map((s) => s.title), titles);
});
