// One Express app. /api = the CIBA HITL lab: the 24-step walkthrough data, a live write call
// (403 + JSON-RPC rewrite -> approve -> replay -> permit), the CIBA approve/deny, decode.
// Loopback Host check and same-origin writes everywhere.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { hostCheck, sameOriginWrites } from './safety.js';
import { createHealth } from './health.js';
import { createFlow, personaOf, agentOf, gatewayOf, downstreamOf, jwtDecode } from './flow.js';
import { buildDiagram } from './diagramData.js';
import { createMode, MODES } from './mode.js';
import { realRun } from './realPingOne.js';
import { workspaceId } from './workspace.js';
import { shelfInfo } from './shelfLink.js';

const WEB_DIST = process.env.WEB_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
const bad = (res, message, status = 400) => res.status(status).json({ error: status === 404 ? 'not_found' : 'bad_request', message });
export const BANNER = (source) => source === 'real'
  ? 'REAL mode: the agent identity, the RFC 8693 exchange and the CIBA backchannel run against YOUR PingOne tenant (owner-configured). The policy decision, the gateway JSON-RPC rewrite and the MCP tool execution stay SIMULATED app-side. Token bodies stay on the server; the Worker secret is a hash only.'
  : 'MOCK mode. SIMULATED: in-process mock IAM, mock Authorize policy, mock CIBA, mock gateway and mock MCP/RS. No tenant, no outbound network. Tokens are mock and labelled.';

export function createApp({ health = createHealth(), mode = createMode(), flow = createFlow() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(hostCheck);
  app.use(sameOriginWrites);
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });

  const api = express.Router();
  api.use(express.json({ limit: '8kb' }));
  // eslint-disable-next-line no-unused-vars
  api.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large' || err instanceof SyntaxError) {
      return res.status(err.type === 'entity.too.large' ? 413 : 400).json({ error: 'bad_request', message: err.type === 'entity.too.large' ? 'request body over 8kb' : 'request body is not valid JSON' });
    }
    return res.status(400).json({ error: 'bad_request', message: 'bad request' });
  });
  api.use('/health', health.router);

  api.get('/info', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ ...mode.info(), banner: BANNER(mode.source()), epoch: flow.state.runs.length, version: (() => { try { return JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version || null; } catch { return null; } })() }); });
  // Rule 19: POST /api/mode with exactly {"source": "mock"|"real"}. Real unconfigured -> 409 with the how-to.
  api.post('/mode', (req, res) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).length !== 1 || !MODES.includes(b.source)) return bad(res, 'body must be exactly {"source": "mock" or "real"}');
    if (b.source === 'real' && mode.info().realAvailable !== true) return res.status(409).json({ error: 'conflict', message: mode.info().realReason });
    mode.set(b.source);
    return res.json({ ...mode.info(), banner: BANNER(mode.source()) });
  });

  api.get('/catalog', (_req, res) => res.json({
    banner: BANNER(mode.source()), source: mode.source(),
    persona: personaOf(), agent: agentOf(), gateway: gatewayOf(), downstream: downstreamOf(),
    diagram: buildDiagram(),
    workspaceId: workspaceId(_req),
  }));

  // The live write call. Without an identifier: steps 1-12 (403 + JSON-RPC error). With one and a
  // recorded approval: steps 15-24 (PERMIT, tool ran). In Real mode the token legs are live.
  api.post('/write', async (req, res) => {
    const h = req.body?.identifierHeader;
    if (h !== undefined && (typeof h !== 'string' || h.length > 200)) return bad(res, 'identifierHeader must be a string of at most 200 characters');
    try {
      const run = mode.source() === 'real'
        ? { ...(await realRun()), outcome: 'real_token_legs', note: 'Real mode runs the token legs live; approve/replay below are the simulated legs.' }
        : await flow.writeCall({ identifierHeader: h });
      run.workspaceId = workspaceId(req);
      return res.json({ banner: BANNER(mode.source()), source: mode.source(), ...run });
    } catch (e) {
      return res.status(502).json({ error: 'real_unavailable', message: e.message });
    }
  });

  // Step 14: the human accepted (or refused) in the application.
  api.post('/approve', (req, res) => {
    const id = req.body?.identifier;
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) return bad(res, 'identifier required');
    return flow.approve(id) ? res.json({ ok: true, identifier: id, state: 'approved' }) : res.status(404).json({ error: 'not_found', message: 'unknown or expired identifier' });
  });
  api.post('/deny', (req, res) => {
    const id = req.body?.identifier;
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) return bad(res, 'identifier required');
    return flow.denyCiba(id) ? res.json({ ok: true, identifier: id, state: 'denied' }) : res.status(404).json({ error: 'not_found', message: 'unknown or expired identifier' });
  });

  api.post('/decode', (req, res) => {
    const t = String(req.body?.token ?? '');
    const claims = jwtDecode(t);
    if (!claims) return bad(res, 'not a decodable JWT');
    return res.json({ claims });
  });

  api.post('/reset', (_req, res) => { flow.reset(); return res.json({ ok: true, epoch: flow.state.runs.length }); });

  if (fs.existsSync(WEB_DIST)) app.use(express.static(WEB_DIST));
  app.get('/favicon.ico', (_req, res) => { res.set('Content-Type', 'image/svg+xml'); res.set('Cache-Control', 'public, max-age=86400'); res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="%23b5122f"/><path d="M4 9h5M8 5l3 4-3 4" stroke="white" stroke-width="2" fill="none"/></svg>'); });
  app.get('/api/shelf', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json(shelfInfo()); }); // the header "Shelf" button
  app.use('/api', api);
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return app;
}
