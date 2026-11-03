// Builds content-pack.json from the step data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { steps } = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/scenarios.json'), 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const src = (id, title, use) => ({ id, title, url: `https://www.rfc-editor.org/rfc/${id}`, kind: 'standard', use, status: 'read', checked: '2026-11-03' });

export function buildPack() {
  return {
    schema: 'demo-content-pack/1',
    id: 'obo-lab',
    title: 'OBO Delegation Inspector LAB',
    version,
    demo: { id: 'obo-lab', name: 'OBO Delegation Inspector LAB', catalog: 'O1', baseUrl: 'http://localhost:7560', doctor: '/api/health', tags: ['obo', 'delegation', 'token-exchange', 'act-claim', 'rfc8693', 'agent-identity', 'mock', 'real'] },
    glossary: [
      { id: 'obo', term: 'On-behalf-of (OBO)', definition: 'An agent acts for a signed-in person: the person\'s identity is kept (sub), the agent is recorded (act), and everything else narrows. Delegation, not impersonation.' },
      { id: 'act', term: 'act claim', definition: 'RFC 8693: names the client that actually performed the exchange on the subject\'s behalf. The downstream requires it; a token without act is a person token, not a delegation.' },
      { id: 'subject-token', term: 'Subject token', definition: 'The signed-in person\'s access token, used as the subject_token in the exchange. The agent never receives it.' },
      { id: 'actor-token', term: 'Actor token', definition: 'The agent\'s own client-credentials token, used as the actor_token. It proves who the agent is without borrowing the person\'s identity.' },
      { id: 'delegation', term: 'Delegation vs impersonation', definition: 'Impersonation would change sub. Delegation keeps sub and adds act: every downstream call can say who the person is AND which agent acted.' },
      { id: 'narrowing', term: 'Scope narrowing', definition: 'The delegated token carries only the scopes the task needs, never the person\'s full set. The exchange cannot widen scope.' },
      { id: 'leak-scan', term: 'Leak scan', definition: 'Everything a page would hand to a model is scanned for token text. Tokens live between the app, the issuer and the API; the model reasons on results only.' },
    ],
    cards: steps.map((s) => ({ id: `step-${s.id}`, label: s.title, description: s.title, group: 'try-it', action: { type: 'route', href: '/#/run' } })),
    sources: [
      src('8693', 'RFC 8693 OAuth 2.0 Token Exchange', 'the exchange and the act claim'),
      src('9449', 'RFC 9449 DPoP', 'what sender-constrained tokens add on top (covered by the stolen-token lab)'),
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), JSON.stringify(buildPack(), null, 2) + '\n');
  console.log('content-pack.json written');
}
