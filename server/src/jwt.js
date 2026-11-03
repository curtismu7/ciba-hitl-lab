// Minimal HS256 JWT sign/verify for the mock issuer. Deterministic fixture secret, never a random
// key, so runs are reproducible. The verifier checks iss, aud, exp, iat and (when required) act.
import crypto from 'node:crypto';

const SECRET = 'obo-lab fixture secret - mock only, never a production key';
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function fixtureSigner(claims, label) {
  const header = { alg: 'HS256', typ: 'JWT', kid: label ?? 'mock' };
  const data = `${b64u(header)}.${b64u(claims)}`;
  return Promise.resolve(`${data}.${hmac(data)}`);
}
export async function createSigner() { return fixtureSigner; }

export function createVerifier() {
  return (token, { aud, requireAct = false, maxScope } = {}) => {
    const parts = String(token).split('.');
    if (parts.length !== 3) return { ok: false, why: 'not a JWT' };
    const expected = hmac(`${parts[0]}.${parts[1]}`);
    if (expected !== parts[2]) return { ok: false, why: 'bad signature' };
    let claims;
    try { claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return { ok: false, why: 'undecodable claims' }; }
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now) return { ok: false, why: 'expired' };
    if (aud && claims.aud !== aud) return { ok: false, why: `audience ${claims.aud} is not ${aud}` };
    if (requireAct && !claims.act) return { ok: false, why: 'no act claim: a token that is not delegated does not name an agent' };
    if (maxScope) {
      const allowed = new Set(maxScope.split(' '));
      for (const s of String(claims.scope ?? '').split(' ')) if (!allowed.has(s)) return { ok: false, why: `scope ${s} is not accepted by the downstream` };
    }
    return { ok: true, why: 'audience matches, act names the agent, scope is accepted' };
  };
}
