// Builds content-pack.json from the step data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEPS } from '../server/src/flow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const src = (id, title, use) => ({ id, title, url: `https://www.rfc-editor.org/rfc/${id}`, kind: 'standard', use, status: 'read', checked: '2026-11-03' });

export function buildPack() {
  return {
    schema: 'demo-content-pack/1',
    id: 'ciba-hitl-lab',
    title: 'CIBA HITL Lab',
    version,
    demo: { id: 'ciba-hitl-lab', name: 'CIBA HITL Lab', catalog: 'C1', baseUrl: 'http://localhost:7580', doctor: '/api/health', tags: ['ciba', 'hitl', 'obo', 'token-exchange', 'json-rpc', 'authorization-policy', 'mcp', 'mock', 'real'] },
    glossary: [
      { id: 'obo', term: 'On-behalf-of (OBO)', definition: 'One token exchange gives the agent a token where sub stays the person and act names the agent. The OBO token keeps the FULL scope set; it does not narrow per tool.' },
      { id: 'hitl', term: 'Human-in-the-loop (HITL)', definition: 'A policy requirement that a sensitive action (here: any write) may only run after a human approves it. The approval is verified by Authorize, never trusted from the agent.' },
      { id: 'ciba', term: 'CIBA', definition: 'Client Initiated Backchannel Authentication: Authorize starts an out-of-band approval request and returns an identifier that ties the DENY to the later PERMIT.' },
      { id: 'identifier', term: 'The identifier', definition: 'Authorizes CIBA request id, returned in the 403, echoed by the agent in a header on replay. Single use: a second replay with the same identifier denies again.' },
      { id: 'jsonrpc', term: 'JSON-RPC 2.0 error rewrite', definition: 'The gateway rewrites the raw 403 into a JSON-RPC 2.0 tool error carrying the identifier, so SDKs that treat a raw 403 as fatal keep the session alive.' },
      { id: 'narrowing', term: 'Policy, not scopes', definition: 'Per-tool narrowing happens in the Authorize policy decision, not in the token: the OBO token carries api:read api:write api:delete end to end.' },
    ],
    cards: STEPS.map((s, i) => ({ id: `step-${i + 1}`, label: s.label, description: s.label, group: 'try-it', action: { type: 'route', href: '/#/flow' } })),
    sources: [
      src('8693', 'RFC 8693 OAuth 2.0 Token Exchange', 'the exchange and the act claim'),
      { id: 'ciba', title: 'OpenID CIBA (Client Initiated Backchannel Authentication)', url: 'https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html', kind: 'standard', use: 'the approval request, the identifier and the backchannel', status: 'read', checked: '2026-11-03' },
      { id: 'jsonrpc2', title: 'JSON-RPC 2.0', url: 'https://www.jsonrpc.org/specification', kind: 'standard', use: 'the tool error shape the gateway rewrites the 403 into', status: 'read', checked: '2026-11-03' },
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), JSON.stringify(buildPack(), null, 2) + '\n');
  console.log('content-pack.json written');
}
