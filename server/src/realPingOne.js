// Real mode: your own PingOne tenant, owner-configured from the shared ~/Development/.env.
// Real covers the LIVE legs that PingOne can serve: the agent's client_credentials token, the
// RFC 8693 token exchange, and (when CIBA_APP_* is set) the backchannel + poll of a real CIBA
// request. The MCP gateway, the policy decision and the JSON-RPC rewrite are app-side logic and
// stay simulated in both modes; the banner says exactly that.
//   PINGONE_ENVIRONMENT_ID, PINGONE_WORKER_CLIENT_ID (or PINGONE_WORKER_ID), PINGONE_WORKER_CLIENT_SECRET
//   CIBA_LAB_PERSON_TOKEN  - a real person access token from the owner's own sign-in (the subject)
//   CIBA_LAB_AUDIENCE      - requested audience for the exchange (the AI gateway)
//   CIBA_LAB_LOGIN_HINT    - the person's user id for the CIBA backchannel (optional)
// Tokens stay server-side; the page shows claims only, the worker secret never leaves the env.
import { loadSharedEnv } from './env.js';
import crypto from 'node:crypto';

const sha8 = (t) => (t ? `sha256 ${crypto.createHash('sha256').update(t).digest('hex').slice(0, 8)} (hash only)` : '-');
export const NO_REAL = 'Real mode is not configured. Set PINGONE_ENVIRONMENT_ID, the Worker app client id + secret, CIBA_LAB_PERSON_TOKEN (a real person access token from your own sign-in) and CIBA_LAB_AUDIENCE in ~/Development/.env, then restart the lab. Agents never sign a person in; the owner supplies the subject token.';

export function realConfigured(env = process.env) {
  const e = { ...env, ...loadSharedEnv() };
  return Boolean(e.PINGONE_ENVIRONMENT_ID && (e.PINGONE_WORKER_CLIENT_ID || e.PINGONE_WORKER_ID) && (e.PINGONE_WORKER_CLIENT_SECRET || e.PINGONE_WORKER_SECRET) && e.CIBA_LAB_PERSON_TOKEN && e.CIBA_LAB_AUDIENCE);
}

const form = (obj) => new URLSearchParams(obj).toString();

async function tokenEndpoint(envId, body, key, { fetchFn = fetch } = {}) {
  const r = await fetchFn(`https://auth.pingone.com/${envId}/as/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(key).toString('base64')}` }, body: form(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PingOne token endpoint answered HTTP ${r.status}: ${j.error ?? ''} ${j.error_description ?? ''}`.trim());
  return j;
}

// Runs the live legs and returns the same shape the mock flow returns, with `real: true`.
// The policy/CIBA-identifier/gateway legs are marked simulated (see the module comment).
export async function realRun({ fetchFn = fetch, env = process.env } = {}) {
  const e = { ...env, ...loadSharedEnv() };
  const envId = e.PINGONE_ENVIRONMENT_ID;
  const clientId = e.PINGONE_WORKER_CLIENT_ID || e.PINGONE_WORKER_ID;
  const secret = e.PINGONE_WORKER_CLIENT_SECRET || e.PINGONE_WORKER_SECRET;
  const key = `${clientId}:${secret}`;
  const personToken = e.CIBA_LAB_PERSON_TOKEN;
  const audience = e.CIBA_LAB_AUDIENCE;
  // step 5-6 live: agent identity
  const cc = await tokenEndpoint(envId, { grant_type: 'client_credentials', scope: e.CIBA_LAB_AGENT_SCOPE || 'agent:identity' }, key, { fetchFn });
  // step 7 live: the exchange
  const xchg = await tokenEndpoint(envId, {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: personToken, subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    actor_token: cc.access_token, actor_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    audience, scope: e.CIBA_LAB_SCOPE || 'api:read api:write api:delete',
  }, key, { fetchFn });
  const decode = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')); } catch { return null; } };
  const d = decode(xchg.access_token) ?? {};
  const i = decode(personToken) ?? {};
  return {
    ok: true, real: true, at: new Date().toISOString(),
    user: { claims: i, sha: sha8(personToken) },
    agent: { claims: decode(cc.access_token) ?? {}, sha: sha8(cc.access_token) },
    obo: { claims: d, sha: sha8(xchg.access_token) },
    delta: { subSame: d.sub === i.sub, audChangedToGateway: Array.isArray(d.aud) ? d.aud.includes(audience) : d.aud === audience, actAdded: Boolean(d.act), fullScopesKept: String(d.scope ?? '').includes('api:write') },
    simulatedLegs: ['policy decision', 'CIBA identifier + gateway JSON-RPC rewrite', 'MCP tool execution', 'response inspection'],
    tokensRedacted: true,
  };
}
