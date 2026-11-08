import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createMode } from '../src/mode.js';

const call = async (app, method, path, body, extraHeaders = {}) => {
  const { createServer } = await import('node:http');
  const server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}`, ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } finally { await new Promise((r) => server.close(r)); }
};
const mk = () => createApp({ mode: createMode({ forceMock: true }) });

test('health returns demo-health/1 ready', async () => {
  const r = await call(mk(), 'GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.schema, 'demo-health/1');
  assert.equal(r.json.state, 'ready');
});

test('catalog: diagram-studio/1 diagram with 24 steps, persona and gateway', async () => {
  const r = await call(mk(), 'GET', '/api/catalog');
  assert.equal(r.status, 200);
  assert.equal(r.json.diagram.steps.length, 24);
  assert.ok(r.json.diagram.steps.every((s) => s.label && s.what));
  assert.equal(r.json.diagram.nodes.length, 8);
  assert.equal(r.json.diagram.edges.length, 24);
  assert.equal(r.json.persona.sub, 'user.0042');
  assert.equal(r.json.gateway.aud, 'https://ai-gateway.invalid');
  assert.equal(r.json.workspaceId, 'default');
});

test('write -> hitl_required with identifier and JSON-RPC error; approve; replay -> permit', async () => {
  const app = mk();
  const first = (await call(app, 'POST', '/api/write', {})).json;
  assert.equal(first.ok, true);
  assert.equal(first.outcome, 'hitl_required');
  assert.equal(first.decision.result, 'DENY');
  assert.equal(first.rpcError.error.code, -32001);
  assert.equal(first.rpcError.error.data.identifier, first.identifier);
  assert.ok((await call(app, 'POST', '/api/approve', { identifier: 'nope' })).status, 404);
  assert.equal((await call(app, 'POST', '/api/approve', { identifier: first.identifier })).status, 200);
  const permit = (await call(app, 'POST', '/api/write', { identifierHeader: first.identifier })).json;
  assert.equal(permit.outcome, 'permit');
  assert.equal(permit.mcp.status, 200);
  assert.equal(permit.obo.claims.act.sub, 'personal-agent');
  // single use
  const again = (await call(app, 'POST', '/api/write', { identifierHeader: first.identifier })).json;
  assert.equal(again.outcome, 'hitl_required');
});

test('deny path: a refused CIBA never permits the replay', async () => {
  const app = mk();
  const first = (await call(app, 'POST', '/api/write', {})).json;
  await call(app, 'POST', '/api/deny', { identifier: first.identifier });
  const replay = (await call(app, 'POST', '/api/write', { identifierHeader: first.identifier })).json;
  assert.equal(replay.outcome, 'hitl_required');
});

test('decode returns claims for a mock token and refuses junk', async () => {
  const app = mk();
  const run = (await call(app, 'POST', '/api/write', {})).json;
  const ok = await call(app, 'POST', '/api/decode', { token: run.obo.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.claims.act.sub, 'personal-agent');
  assert.equal((await call(app, 'POST', '/api/decode', { token: 'junk' })).status, 400);
});

test('reset clears approvals: a previously approved identifier denies again', async () => {
  const app = mk();
  const run = (await call(app, 'POST', '/api/write', {})).json;
  await call(app, 'POST', '/api/approve', { identifier: run.identifier });
  await call(app, 'POST', '/api/reset', {});
  const replay = (await call(app, 'POST', '/api/write', { identifierHeader: run.identifier })).json;
  assert.equal(replay.outcome, 'hitl_required');
});

test('rule 19: default mock, real 409 with the how-to, switch back works, body shape enforced', async () => {
  const app = mk();
  const info = (await call(app, 'GET', '/api/info')).json;
  assert.equal(info.source, 'mock');
  assert.equal(info.realAvailable, false);
  assert.match(info.realReason, /PINGONE/);
  const up = await call(app, 'POST', '/api/mode', { source: 'real' });
  assert.equal(up.status, 409);
  const back = await call(app, 'POST', '/api/mode', { source: 'mock' });
  assert.equal(back.status, 200);
  assert.equal((await call(app, 'POST', '/api/mode', { source: 'live' })).status, 400);
  assert.equal((await call(app, 'POST', '/api/mode', { source: 'real', x: 1 })).status, 400);
});

test('cross-origin write is refused', async () => {
  const r = await call(mk(), 'POST', '/api/write', {}, { origin: 'http://evil.invalid' });
  assert.equal(r.status, 403);
});

test('LAB_ALLOWED_HOSTS: a listed domain passes the Host check, an unlisted one is refused', async () => {
  process.env.LAB_ALLOWED_HOSTS = 'local.ping-devops.com';
  try {
    const r = await call(mk(), 'GET', '/api/health', undefined, { host: 'local.ping-devops.com' });
    assert.equal(r.status, 200);
  } finally { delete process.env.LAB_ALLOWED_HOSTS; }
});

test('LAB_ALLOWED_HOSTS: the Host header is honoured (raw http, fetch strips it)', async () => {
  process.env.LAB_ALLOWED_HOSTS = 'local.ping-devops.com';
  const { createServer } = await import('node:http');
  const server = createServer(mk());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const get = (host) => new Promise((resolve) => {
      import('node:http').then(({ request }) => {
        const req = request({ host: '127.0.0.1', port, path: '/api/health', headers: { host } }, (res) => {
          let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', () => resolve(0)); req.end();
      });
    });
    assert.equal(await get('local.ping-devops.com'), 200);
    assert.equal(await get('evil.example'), 403);
  } finally { server.close(); delete process.env.LAB_ALLOWED_HOSTS; }
});

test('GET /api/shelf answers with the configured SHELF_URL (no web build needed) and is GET only', async () => {
  const prev = process.env.SHELF_URL;
  process.env.SHELF_URL = 'https://shelf.example:8443/';
  try {
    const r = await call(mk(), 'GET', '/api/shelf');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { shelfUrl: 'https://shelf.example:8443' });
    assert.notEqual((await call(mk(), 'POST', '/api/shelf', {})).status, 200);
  } finally { if (prev === undefined) delete process.env.SHELF_URL; else process.env.SHELF_URL = prev; }
});

test('behind the lab-proxy: a write is accepted only with the proxy\'s forwarded origin AND an allowed Host', async () => {
  const { createServer, request } = await import('node:http');
  const PROXY = 'ciba-hitl-lab.local.ping-devops.com';
  const FWD = { 'x-forwarded-host': 'local.ping-devops.com:8443', 'x-forwarded-proto': 'https' };
  process.env.LAB_ALLOWED_HOSTS = PROXY;
  const server = createServer(mk());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    // node:http, because fetch cannot set Host
    const send = (host, headers) => new Promise((resolve, reject) => {
      const body = '{}';
      const req = request({ host: '127.0.0.1', port, path: '/api/write', method: 'POST', headers: { host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end(body);
    });
    const via = (headers) => send(`${PROXY}:${port}`, headers);
    // what the browser and the proxy really send for a same-origin POST
    assert.equal(await via({ ...FWD, origin: 'https://local.ping-devops.com:8443', 'sec-fetch-site': 'same-origin' }), 200);
    assert.equal(await via({ ...FWD, origin: 'https://local.ping-devops.com:8443' }), 200);
    // refused: a foreign origin, a mismatched forwarded host, a wrong scheme, a cross-site fetch, no forwarded host at all
    for (const headers of [
      { ...FWD, origin: 'https://evil.example' },
      { ...FWD, origin: 'https://local.ping-devops.com:9999' },
      { ...FWD, origin: 'http://local.ping-devops.com:8443' },
      { ...FWD, origin: 'https://local.ping-devops.com:8443', 'sec-fetch-site': 'cross-site' },
      { origin: 'https://local.ping-devops.com:8443' },
      { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https', origin: 'https://local.ping-devops.com:8443' },
    ]) assert.equal(await via(headers), 403, JSON.stringify(headers));
    // the forwarded headers are not believed on a loopback Host: a page that did not come through the proxy cannot use them
    assert.equal(await send(`127.0.0.1:${port}`, { ...FWD, origin: 'https://local.ping-devops.com:8443' }), 403);
  } finally { server.close(); delete process.env.LAB_ALLOWED_HOSTS; }
});
